import assert from 'node:assert';
import test from 'node:test';
import {
  emailExibivel,
  formatPhoneBR,
  identificadorExibivel,
  isSyntheticEmail,
  isValidPhone,
  maskPhoneInput,
  normalizePhone,
  phoneFromSyntheticEmail,
  PhoneValidationError,
  phoneToSyntheticEmail,
  SYNTHETIC_EMAIL_DOMAIN,
  tryNormalizePhone,
} from './phone';

test('Telefone como identidade', async (t) => {
  await t.test('1. normalizePhone — prefixa 55 em 10/11 dígitos', () => {
    assert.strictEqual(normalizePhone('71999999999'), '5571999999999');
    assert.strictEqual(normalizePhone('(71) 99999-9999'), '5571999999999');
    assert.strictEqual(normalizePhone('7133334444'), '557133334444');
    assert.strictEqual(normalizePhone(' 71 3333 4444 '), '557133334444');
  });

  await t.test('2. normalizePhone — mantém quem já veio com DDI', () => {
    assert.strictEqual(normalizePhone('5571999999999'), '5571999999999');
    assert.strictEqual(normalizePhone('+55 (71) 99999-9999'), '5571999999999');
    assert.strictEqual(normalizePhone('557133334444'), '557133334444');
  });

  await t.test('3. normalizePhone — recusa fora da faixa 12–13 dígitos', () => {
    // Curto demais (sem DDD) e longo demais (dedo pesado no teclado).
    assert.throws(() => normalizePhone('999999999'), PhoneValidationError);
    assert.throws(() => normalizePhone('55719999999999'), PhoneValidationError);
    assert.throws(() => normalizePhone(''), PhoneValidationError);
    assert.throws(() => normalizePhone('abc'), PhoneValidationError);
    // 12 dígitos que NÃO começam com 55 não são um telefone BR com DDI.
    assert.throws(() => normalizePhone('117199999999'), PhoneValidationError);
  });

  await t.test('4. tryNormalizePhone / isValidPhone não lançam', () => {
    assert.strictEqual(tryNormalizePhone('71999999999'), '5571999999999');
    assert.strictEqual(tryNormalizePhone('123'), null);
    assert.strictEqual(tryNormalizePhone(null), null);
    assert.strictEqual(isValidPhone('(71) 99999-9999'), true);
    assert.strictEqual(isValidPhone('999'), false);
  });

  await t.test('5. formatPhoneBR — celular e fixo', () => {
    assert.strictEqual(formatPhoneBR('5571999999999'), '+55 (71) 99999-9999');
    assert.strictEqual(formatPhoneBR('71999999999'), '+55 (71) 99999-9999');
    assert.strictEqual(formatPhoneBR('557133334444'), '+55 (71) 3333-4444');
    // Entrada inválida sai como veio — formatação nunca derruba uma tela.
    assert.strictEqual(formatPhoneBR('123'), '123');
    assert.strictEqual(formatPhoneBR(null), '');
  });

  await t.test('6. maskPhoneInput — máscara progressiva', () => {
    assert.strictEqual(maskPhoneInput(''), '');
    assert.strictEqual(maskPhoneInput('7'), '(7');
    assert.strictEqual(maskPhoneInput('71'), '(71');
    assert.strictEqual(maskPhoneInput('719'), '(71) 9');
    assert.strictEqual(maskPhoneInput('7133334444'), '(71) 3333-4444');
    assert.strictEqual(maskPhoneInput('71999999999'), '(71) 99999-9999');
    // DDI digitado é absorvido, não duplicado, e o excesso é cortado.
    assert.strictEqual(maskPhoneInput('5571999999999'), '(71) 99999-9999');
    assert.strictEqual(maskPhoneInput('71999999999999'), '(71) 99999-9999');
  });

  await t.test('7. e-mail sintético — ida e volta', () => {
    assert.strictEqual(
      phoneToSyntheticEmail('(71) 99999-9999'),
      `5571999999999@${SYNTHETIC_EMAIL_DOMAIN}`,
    );
    assert.strictEqual(isSyntheticEmail(`5571999999999@${SYNTHETIC_EMAIL_DOMAIN}`), true);
    assert.strictEqual(isSyntheticEmail('fornecedor@empresa.com.br'), false);
    assert.strictEqual(isSyntheticEmail(null), false);
    assert.strictEqual(
      phoneFromSyntheticEmail(`5571999999999@${SYNTHETIC_EMAIL_DOMAIN}`),
      '5571999999999',
    );
    assert.strictEqual(phoneFromSyntheticEmail('fornecedor@empresa.com.br'), null);
  });

  await t.test('8. e-mail sintético nunca vaza pra UI', () => {
    assert.strictEqual(emailExibivel(`5571999999999@${SYNTHETIC_EMAIL_DOMAIN}`), null);
    assert.strictEqual(emailExibivel('fornecedor@empresa.com.br'), 'fornecedor@empresa.com.br');
    assert.strictEqual(emailExibivel(null), null);

    // Sem telefone na linha de `users`, o identificador ainda é o telefone —
    // reconstruído a partir do próprio e-mail sintético.
    assert.strictEqual(
      identificadorExibivel(null, `5571999999999@${SYNTHETIC_EMAIL_DOMAIN}`),
      '+55 (71) 99999-9999',
    );
    assert.strictEqual(identificadorExibivel('5571999999999', null), '+55 (71) 99999-9999');
    assert.strictEqual(
      identificadorExibivel(null, 'fornecedor@empresa.com.br'),
      'fornecedor@empresa.com.br',
    );
    assert.strictEqual(identificadorExibivel(null, null), '');
  });
});
