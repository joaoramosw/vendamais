export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          nome: string
          email: string
          username: string | null
          role_id: string
          organization_name: string | null
          active_organization_id: string | null
          must_change_password: boolean
          whatsapp: string | null
          created_at: string
        }
        Insert: {
          id: string
          nome: string
          email: string
          username?: string | null
          role_id: string
          organization_name?: string | null
          active_organization_id?: string | null
          must_change_password?: boolean
          whatsapp?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          nome?: string
          email?: string
          username?: string | null
          role_id?: string
          organization_name?: string | null
          active_organization_id?: string | null
          must_change_password?: boolean
          whatsapp?: string | null
          created_at?: string
        }
      }
      roles: {
        Row: {
          id: string
          key: RoleKey
          name: string
          created_at: string
        }
        Insert: {
          id?: string
          key: RoleKey
          name: string
          created_at?: string
        }
        Update: {
          id?: string
          key?: RoleKey
          name?: string
          created_at?: string
        }
      }
      permissions: {
        Row: {
          id: string
          key: PermissionKey
          description: string | null
          created_at: string
        }
        Insert: {
          id?: string
          key: PermissionKey
          description?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          key?: PermissionKey
          description?: string | null
          created_at?: string
        }
      }
      role_permissions: {
        Row: {
          role_id: string
          permission_id: string
        }
        Insert: {
          role_id: string
          permission_id: string
        }
        Update: {
          role_id?: string
          permission_id?: string
        }
      }
      invitations: {
        Row: {
          id: string
          token: string
          email: string
          role: RoleKey
          invited_by: string | null
          accepted_at: string | null
          expires_at: string
          created_at: string
        }
        Insert: {
          id?: string
          token?: string
          email: string
          role?: RoleKey
          invited_by?: string | null
          accepted_at?: string | null
          expires_at?: string
          created_at?: string
        }
        Update: {
          id?: string
          token?: string
          email?: string
          role?: RoleKey
          invited_by?: string | null
          accepted_at?: string | null
          expires_at?: string
          created_at?: string
        }
      }
      audit_log: {
        Row: {
          id: number
          actor_user_id: string
          acting_as_org_id: string | null
          action: string
          resource_type: string | null
          resource_id: string | null
          metadata: Json | null
          ip_address: string | null
          created_at: string
        }
        Insert: {
          id?: number
          actor_user_id: string
          acting_as_org_id?: string | null
          action: string
          resource_type?: string | null
          resource_id?: string | null
          metadata?: Json | null
          ip_address?: string | null
          created_at?: string
        }
        Update: {
          id?: number
          actor_user_id?: string
          acting_as_org_id?: string | null
          action?: string
          resource_type?: string | null
          resource_id?: string | null
          metadata?: Json | null
          ip_address?: string | null
          created_at?: string
        }
      }
      cotacoes: {
        Row: {
          id: string
          admin_id: string
          titulo: string
          status: 'rascunho' | 'aberta' | 'em_andamento' | 'encerrada'
          data_limite: string | null
          created_at: string
        }
        Insert: {
          id?: string
          admin_id: string
          titulo: string
          status?: 'rascunho' | 'aberta' | 'em_andamento' | 'encerrada'
          data_limite?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          admin_id?: string
          titulo?: string
          status?: 'rascunho' | 'aberta' | 'em_andamento' | 'encerrada'
          data_limite?: string | null
          created_at?: string
        }
      }
      cotacao_itens: {
        Row: {
          id: string
          cotacao_id: string
          product_id: string | null
          nome_produto: string
          descricao: string | null
          unidade: string
          quantidade: number
          observacao: string | null
          codigo_barras: string | null
          categoria: string | null
          estoque_atual: number | null
          quantidade_sugerida: number | null
          tipo_unidade: 'UN' | 'CX' | 'DZ' | 'FD'
        }
        Insert: {
          id?: string
          cotacao_id: string
          product_id?: string | null
          nome_produto: string
          descricao?: string | null
          unidade?: string
          quantidade: number
          observacao?: string | null
          codigo_barras?: string | null
          categoria?: string | null
          estoque_atual?: number | null
          quantidade_sugerida?: number | null
          tipo_unidade?: 'UN' | 'CX' | 'DZ' | 'FD'
        }
        Update: {
          id?: string
          cotacao_id?: string
          product_id?: string | null
          nome_produto?: string
          descricao?: string | null
          unidade?: string
          quantidade?: number
          observacao?: string | null
          codigo_barras?: string | null
          categoria?: string | null
          estoque_atual?: number | null
          quantidade_sugerida?: number | null
          tipo_unidade?: 'UN' | 'CX' | 'DZ' | 'FD'
        }
      }
      propostas: {
        Row: {
          id: string
          cotacao_id: string
          fornecedor_id: string
          status: 'enviada' | 'recebida' | 'aceita' | 'recusada'
          valor_total: number | null
          observacao: string | null
          created_at: string
        }
        Insert: {
          id?: string
          cotacao_id: string
          fornecedor_id: string
          status?: 'enviada' | 'recebida' | 'aceita' | 'recusada'
          valor_total?: number | null
          observacao?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          cotacao_id?: string
          fornecedor_id?: string
          status?: 'enviada' | 'recebida' | 'aceita' | 'recusada'
          valor_total?: number | null
          observacao?: string | null
          created_at?: string
        }
      }
      proposta_itens: {
        Row: {
          id: string
          proposta_id: string
          produto_nome: string
          quantidade: number
          preco_unitario: number
          observacao: string | null
        }
        Insert: {
          id?: string
          proposta_id: string
          produto_nome: string
          quantidade: number
          preco_unitario: number
          observacao?: string | null
        }
        Update: {
          id?: string
          proposta_id?: string
          produto_nome?: string
          quantidade?: number
          preco_unitario?: number
          observacao?: string | null
        }
      }
      fornecedores_convidados: {
        Row: {
          id: string
          cotacao_id: string
          email_contato: string
          whatsapp: string | null
          token_acesso: string
          status_convite: 'pendente' | 'aceito' | 'recusado'
          created_at: string
        }
        Insert: {
          id?: string
          cotacao_id: string
          email_contato: string
          whatsapp?: string | null
          token_acesso: string
          status_convite?: 'pendente' | 'aceito' | 'recusado'
          created_at?: string
        }
        Update: {
          id?: string
          cotacao_id?: string
          email_contato?: string
          whatsapp?: string | null
          token_acesso?: string
          status_convite?: 'pendente' | 'aceito' | 'recusado'
          created_at?: string
        }
      }
      products: {
        Row: {
          id: string
          name: string
          description: string | null
          barcode: string | null
          image_url: string | null
          category: string | null
          created_by: string | null
          organization_id: string | null
          created_at: string
          updated_at: string | null
          price_unit_store: number
        }
        Insert: {
          id?: string
          name: string
          description?: string | null
          barcode?: string | null
          image_url?: string | null
          category?: string | null
          created_by?: string | null
          organization_id?: string | null
          created_at?: string
          updated_at?: string | null
          price_unit_store?: number
        }
        Update: {
          id?: string
          name?: string
          description?: string | null
          barcode?: string | null
          image_url?: string | null
          category?: string | null
          created_by?: string | null
          organization_id?: string | null
          created_at?: string
          updated_at?: string | null
          price_unit_store?: number
        }
      }
      product_quotes: {
        Row: {
          id: string
          product_id: string
          company_name: string
          price: number
          created_at: string
        }
        Insert: {
          id?: string
          product_id: string
          company_name: string
          price: number
          created_at?: string
        }
        Update: {
          id?: string
          product_id?: string
          company_name?: string
          price?: number
          created_at?: string
        }
      }
      categories: {
        Row: {
          id: string
          name: string
          slug: string
          description: string | null
          color: string
          organization_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          slug: string
          description?: string | null
          color?: string
          organization_id?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          slug?: string
          description?: string | null
          color?: string
          organization_id?: string | null
          created_at?: string
        }
      }
      product_categories: {
        Row: {
          id: string
          product_id: string
          category_id: string
        }
        Insert: {
          id?: string
          product_id: string
          category_id: string
        }
        Update: {
          id?: string
          product_id?: string
          category_id?: string
        }
      }
      site_settings: {
        Row: {
          id: string
          organization_id: string | null
          theme_preset: string
          theme_tokens: Json
          home_blocks_draft: Json
          home_blocks_published: Json
          updated_by: string | null
          updated_at: string
        }
        Insert: {
          id?: string
          organization_id?: string | null
          theme_preset?: string
          theme_tokens?: Json
          home_blocks_draft?: Json
          home_blocks_published?: Json
          updated_by?: string | null
          updated_at?: string
        }
        Update: {
          id?: string
          organization_id?: string | null
          theme_preset?: string
          theme_tokens?: Json
          home_blocks_draft?: Json
          home_blocks_published?: Json
          updated_by?: string | null
          updated_at?: string
        }
      }
    }
    Enums: {
      role_key: 'admin' | 'supplier'
      permission_key:
        | 'users.read'
        | 'users.create'
        | 'users.update'
        | 'users.disable'
        | 'quotes.manage'
        | 'quotes.respond'
        | 'products.manage'
        | 'categories.manage'
        | 'dashboard.read'
      cotacao_status: 'rascunho' | 'aberta' | 'em_andamento' | 'encerrada'
      proposta_status: 'enviada' | 'recebida' | 'aceita' | 'recusada'
      unit_type: 'UN' | 'CX' | 'DZ' | 'FD'
      convite_status: 'pendente' | 'aceito' | 'recusado'
    }
  }
}

// ── Convenience type aliases ────────────────────────────────────────────────

export type UserRow = Database['public']['Tables']['users']['Row']
export type RoleRow = Database['public']['Tables']['roles']['Row']
export type PermissionRow = Database['public']['Tables']['permissions']['Row']
export type InvitationRow = Database['public']['Tables']['invitations']['Row']
export type Cotacao = Database['public']['Tables']['cotacoes']['Row']
export type CotacaoItem = Database['public']['Tables']['cotacao_itens']['Row']
export type Proposta = Database['public']['Tables']['propostas']['Row']
export type PropostaItem = Database['public']['Tables']['proposta_itens']['Row']
export type Product = Database['public']['Tables']['products']['Row']
export type ProductQuote = Database['public']['Tables']['product_quotes']['Row']
export type Category = Database['public']['Tables']['categories']['Row']
export type ProductCategory = Database['public']['Tables']['product_categories']['Row']
export type FornecedorConvidado = Database['public']['Tables']['fornecedores_convidados']['Row']
export type SiteSettingsRow = Database['public']['Tables']['site_settings']['Row']

// ── Role / Permission keys ──────────────────────────────────────────────────

export type RoleKey = 'admin' | 'supplier'

export type PermissionKey =
  | 'users.read'
  | 'users.create'
  | 'users.update'
  | 'users.disable'
  | 'quotes.manage'
  | 'quotes.respond'
  | 'products.manage'
  | 'categories.manage'
  | 'dashboard.read'

// ── Domain types (simplified, replacing the old ones) ───────────────────────

export type UnitType = 'UN' | 'CX' | 'DZ' | 'FD'
export type PropostaStatus = 'enviada' | 'recebida' | 'aceita' | 'recusada'

// ── Extended types for joins ────────────────────────────────────────────────

export type CotacaoItemPublic = Omit<CotacaoItem, 'estoque_atual' | 'quantidade_sugerida'>

export type CotacaoComItens = Cotacao & {
  cotacao_itens: CotacaoItem[]
  users: Pick<UserRow, 'nome' | 'organization_name'>
}

export type PropostaComItens = Proposta & {
  proposta_itens: (PropostaItem & {
    cotacao_itens: Pick<CotacaoItem, 'nome_produto' | 'unidade' | 'quantidade' | 'tipo_unidade'>
  })[]
  users: Pick<UserRow, 'nome' | 'organization_name'>
}

export type CotacaoComPropostas = CotacaoComItens & {
  propostas: (Proposta & {
    users: Pick<UserRow, 'nome' | 'organization_name'>
  })[]
}

export type ProductWithQuote = Product & {
  latest_quote: ProductQuote | null
  categories?: Category[]
}

export type CategoryWithCount = Category & {
  product_count: number
}

// ── RBAC — Permission Context ───────────────────────────────────────────────

export type CotacaoPermissionContext = {
  userRole: RoleKey
  userId: string
  cotacaoAdminId: string
  cotacaoStatus: 'rascunho' | 'aberta' | 'em_andamento' | 'encerrada'
}

// ── Backward compatibility aliases (deprecated — remove in next cleanup) ────

/** @deprecated Use UserRow instead */
export type Profile = UserRow
/** @deprecated Use UserRow instead */
export type BasicProfile = UserRow
/** @deprecated Use RoleKey instead */
export type UserRole = RoleKey
/** @deprecated Use RoleKey instead */
export type UserTipo = RoleKey
/** @deprecated Use RoleKey instead */
export type GlobalRole = RoleKey
/** @deprecated Dead code — membership system removed */
export type MembershipRole = 'owner' | 'admin' | 'member' | 'vendedor'
/** @deprecated Dead code — organization system removed */
export type OrganizationTipo = 'lojista' | 'fornecedor'
/** @deprecated Dead code — organization system removed */
export type Organization = { id: string; name: string; cnpj: string | null; tipo: string; slug: string | null; created_at: string }
