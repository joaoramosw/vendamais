import { Injectable } from '@nestjs/common';
import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import { CotacoesService } from './cotacoes.service';
import { CotacaoItemRow, CotacaoRow } from './cotacoes.types';
import { PropostasService } from '../propostas/propostas.service';
import { ItemResultado, RankingEntry } from '../propostas/ranking-por-item.util';
import { ExportCotacaoQueryDto } from './dto/export-cotacao-query.dto';
import { slugify } from './slug.util';

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

function identidade(entry: Pick<RankingEntry, 'nome_empresa' | 'email_contato'>): string {
  return entry.nome_empresa || entry.email_contato || 'Fornecedor';
}

interface LinhaExport {
  produto: string;
  /** Preço praticado na loja (products.price_unit_store) — mesma coluna
   * "Preço loja" da tela de comparação. */
  precoLoja: string;
  top1: string;
  top2: string;
  top3: string;
  estoque: string;
  sugestao: string;
  precoUnitario: string;
  /** Preço efetivo × sugestão, já numérico — usado só no total do PDF
   * (as demais colunas guardam texto formatado, pronto pra exibição). */
  subtotal: number;
}

/** Chaves de LinhaExport exibidas como coluna de tabela — exclui `subtotal`,
 * que é usado só para calcular o total, nunca renderizado por célula. */
type ColunaKey = Exclude<keyof LinhaExport, 'subtotal'>;

export interface ExportResult {
  buffer: Buffer;
  filename: string;
  mimeType: string;
}

@Injectable()
export class CotacoesExportService {
  constructor(
    private readonly cotacoesService: CotacoesService,
    private readonly propostasService: PropostasService,
  ) {}

  async exportar(
    adminId: string,
    cotacaoId: string,
    query: ExportCotacaoQueryDto,
  ): Promise<ExportResult> {
    const { cotacao, itens } = await this.cotacoesService.detalhe(adminId, cotacaoId);

    let rankingPorItem = new Map<string, ItemResultado>();
    if (cotacao.status === 'fechada' || cotacao.status === 'aberta') {
      const resultado = await this.propostasService.resultadoPorItem(adminId, cotacaoId);
      rankingPorItem = new Map(resultado.itens.map((item) => [item.cotacao_item_id, item]));
    }

    const incluirInternos = query.incluir_internos ?? true;
    const linhas = itens.map((item) => this.montarLinha(item, rankingPorItem.get(item.id), incluirInternos));
    const totalEstimado = linhas.reduce((sum, linha) => sum + linha.subtotal, 0);

    const ext = query.formato === 'xlsx' ? 'xlsx' : 'pdf';
    const filename = `cotacao-${slugify(cotacao.titulo)}-${new Date().toISOString().slice(0, 10)}.${ext}`;

    const buffer =
      query.formato === 'xlsx'
        ? await this.gerarXlsx(cotacao, linhas, incluirInternos)
        : await this.gerarPdf(cotacao, linhas, incluirInternos, totalEstimado);

    return {
      buffer,
      filename,
      mimeType:
        query.formato === 'xlsx'
          ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
          : 'application/pdf',
    };
  }

  private montarLinha(
    item: CotacaoItemRow,
    resultado: ItemResultado | undefined,
    incluirInternos: boolean,
  ): LinhaExport {
    const ranking = resultado?.ranking ?? [];
    const [primeiro, segundo, terceiro] = ranking;
    const precoEfetivo = item.preco_unitario_manual ?? primeiro?.preco_unitario ?? null;

    return {
      produto: item.nome_produto,
      precoLoja: resultado?.preco_loja != null ? BRL.format(resultado.preco_loja) : '—',
      top1: primeiro ? `${identidade(primeiro)} — ${BRL.format(primeiro.preco_unitario)}` : '—',
      top2: segundo ? `${identidade(segundo)} — ${BRL.format(segundo.preco_unitario)}` : '—',
      top3: terceiro ? `${identidade(terceiro)} — ${BRL.format(terceiro.preco_unitario)}` : '—',
      estoque: incluirInternos ? String(item.estoque_atual ?? '—') : '',
      sugestao: incluirInternos ? String(item.quantidade_sugerida ?? '—') : '',
      precoUnitario: precoEfetivo != null ? BRL.format(precoEfetivo) : '—',
      subtotal: precoEfetivo != null ? precoEfetivo * (item.quantidade_sugerida ?? 0) : 0,
    };
  }

  private colunas(incluirInternos: boolean): Array<{ header: string; key: ColunaKey; width: number }> {
    const base: Array<{ header: string; key: ColunaKey; width: number }> = [
      { header: 'Produto', key: 'produto', width: 32 },
      { header: 'Preço loja', key: 'precoLoja', width: 14 },
      { header: 'Top 1', key: 'top1', width: 26 },
      { header: 'Top 2', key: 'top2', width: 26 },
      { header: 'Top 3', key: 'top3', width: 26 },
    ];

    if (incluirInternos) {
      base.push(
        { header: 'Estoque', key: 'estoque', width: 12 },
        { header: 'Sugestão', key: 'sugestao', width: 12 },
      );
    }

    base.push({ header: 'Preço unit.', key: 'precoUnitario', width: 16 });
    return base;
  }

  private async gerarXlsx(
    cotacao: CotacaoRow,
    linhas: LinhaExport[],
    incluirInternos: boolean,
  ): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet(cotacao.titulo.slice(0, 31) || 'Cotação');
    const colunas = this.colunas(incluirInternos);

    sheet.columns = colunas.map((c) => ({ header: c.header, key: c.key, width: c.width }));
    sheet.getRow(1).font = { bold: true };

    for (const linha of linhas) {
      sheet.addRow(linha);
    }

    const arrayBuffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(arrayBuffer);
  }

  /** Colunas cujo conteúdo é numérico/monetário — alinhadas à direita, como
   * em qualquer relatório tabular legível. */
  private static readonly COLUNAS_NUMERICAS = new Set<ColunaKey>([
    'precoLoja',
    'estoque',
    'sugestao',
    'precoUnitario',
  ]);

  private async gerarPdf(
    cotacao: CotacaoRow,
    linhas: LinhaExport[],
    incluirInternos: boolean,
    totalEstimado: number,
  ): Promise<Buffer> {
    const colunas = this.colunas(incluirInternos);
    const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 36, bufferPages: true });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));

    const finished = new Promise<Buffer>((resolve) => {
      doc.on('end', () => resolve(Buffer.concat(chunks)));
    });

    const COLOR_HEADER_BG = '#1f2937';
    const COLOR_HEADER_TEXT = '#ffffff';
    const COLOR_ZEBRA_BG = '#f3f4f6';
    const COLOR_BORDER = '#d1d5db';
    const COLOR_TEXT = '#111827';
    const COLOR_MUTED = '#6b7280';

    const marginLeft = doc.page.margins.left;
    const usableWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const totalColWidth = colunas.reduce((sum, c) => sum + c.width, 0);
    const scale = usableWidth / totalColWidth;
    const colWidths = colunas.map((c) => c.width * scale);
    const colX: number[] = [];
    {
      let x = marginLeft;
      for (const w of colWidths) {
        colX.push(x);
        x += w;
      }
    }

    const rowHeight = 20;
    const headerRowHeight = 22;
    const cellPaddingX = 5;
    const footerReserve = 26; // espaço pro rodapé (nº de página) na última linha da página

    let tableSegmentTop = 0; // topo do bloco de linhas desenhado na página atual (pra fechar a grade)

    const desenharGradeSegmento = (top: number, bottom: number) => {
      if (bottom <= top) return;
      doc.save();
      doc.strokeColor(COLOR_BORDER).lineWidth(0.6);
      doc.rect(marginLeft, top, usableWidth, bottom - top).stroke();
      for (let i = 1; i < colWidths.length; i++) {
        doc.moveTo(colX[i], top).lineTo(colX[i], bottom).stroke();
      }
      doc.restore();
    };

    const desenharCabecalhoTabela = () => {
      const y = doc.y;
      doc.save();
      doc.rect(marginLeft, y, usableWidth, headerRowHeight).fill(COLOR_HEADER_BG);
      doc.fillColor(COLOR_HEADER_TEXT).font('Helvetica-Bold').fontSize(9);
      colunas.forEach((c, i) => {
        const align = CotacoesExportService.COLUNAS_NUMERICAS.has(c.key) ? 'right' : 'left';
        doc.text(c.header, colX[i] + cellPaddingX, y + 6, {
          width: colWidths[i] - cellPaddingX * 2,
          align,
        });
      });
      doc.restore();
      doc.y = y + headerRowHeight;
      tableSegmentTop = y;
    };

    const desenharLinha = (linha: LinhaExport, index: number) => {
      const y = doc.y;
      if (index % 2 === 1) {
        doc.save();
        doc.rect(marginLeft, y, usableWidth, rowHeight).fill(COLOR_ZEBRA_BG);
        doc.restore();
      }
      doc.fillColor(COLOR_TEXT).font('Helvetica').fontSize(8.5);
      colunas.forEach((c, i) => {
        const align = CotacoesExportService.COLUNAS_NUMERICAS.has(c.key) ? 'right' : 'left';
        doc.text(linha[c.key], colX[i] + cellPaddingX, y + 6, {
          width: colWidths[i] - cellPaddingX * 2,
          height: rowHeight - 4,
          ellipsis: true,
          align,
        });
      });
      doc.y = y + rowHeight;
    };

    // Cabeçalho do documento
    doc.fillColor(COLOR_TEXT).fontSize(16).font('Helvetica-Bold').text(cotacao.titulo);
    doc.moveDown(0.15);
    const statusLabel =
      cotacao.status === 'fechada'
        ? `Resultado final — encerrada em ${new Date(cotacao.data_fechamento ?? cotacao.created_at).toLocaleDateString('pt-BR')}`
        : cotacao.status === 'aberta'
          ? 'Resultado parcial — cotação ainda aberta, pode receber novas propostas'
          : 'Cotação';
    doc
      .fillColor(COLOR_MUTED)
      .fontSize(9)
      .font('Helvetica')
      .text(`${statusLabel}  ·  Gerado em ${new Date().toLocaleString('pt-BR')}`);
    doc.moveDown(0.6);

    desenharCabecalhoTabela();

    linhas.forEach((linha, index) => {
      if (doc.y + rowHeight > doc.page.height - doc.page.margins.bottom - footerReserve) {
        desenharGradeSegmento(tableSegmentTop, doc.y);
        doc.addPage();
        doc.y = doc.page.margins.top;
        desenharCabecalhoTabela();
      }
      desenharLinha(linha, index);
    });

    desenharGradeSegmento(tableSegmentTop, doc.y);

    // Total estimado (Sugestão × preço unitário) — mesmo cálculo da tela de resultado.
    doc.moveDown(0.7);
    doc.font('Helvetica-Bold').fontSize(10).fillColor(COLOR_TEXT);
    doc.text(`Total estimado: ${BRL.format(totalEstimado)}`, marginLeft, doc.y, {
      width: usableWidth,
      align: 'right',
    });

    // Rodapé com numeração de página em todas as páginas do documento.
    const range = doc.bufferedPageRange();
    for (let i = range.start; i < range.start + range.count; i++) {
      doc.switchToPage(i);
      doc
        .font('Helvetica')
        .fontSize(8)
        .fillColor(COLOR_MUTED)
        .text(`Página ${i + 1} de ${range.count}`, marginLeft, doc.page.height - doc.page.margins.bottom + 10, {
          width: usableWidth,
          align: 'right',
        });
    }

    doc.end();
    return finished;
  }
}
