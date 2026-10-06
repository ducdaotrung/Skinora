const MONEY_FORMATS = Object.freeze({
  amount: { precision: 2, thousands: ',', decimal: '.' },
  amount_no_decimals: { precision: 0, thousands: ',', decimal: '.' },
  amount_with_comma_separator: { precision: 2, thousands: '.', decimal: ',' },
  amount_no_decimals_with_comma_separator: { precision: 0, thousands: '.', decimal: ',' },
  amount_with_apostrophe_separator: { precision: 2, thousands: "'", decimal: '.' },
  amount_no_decimals_with_space_separator: { precision: 0, thousands: ' ', decimal: '.' },
  amount_with_space_separator: { precision: 2, thousands: ' ', decimal: ',' },
  amount_with_period_and_space_separator: { precision: 2, thousands: ' ', decimal: '.' },
});

const DEFAULT_MONEY_FORMAT = MONEY_FORMATS.amount;
const MONEY_PLACEHOLDER = /\{\{\s*(\w+)\s*\}\}/;
const decodedFormatTemplates = new Map();

function decodeFormatTemplate(template) {
  if (!template.includes('&')) return template;
  if (decodedFormatTemplates.has(template)) return decodedFormatTemplates.get(template);

  const decoder = document.createElement('textarea');
  decoder.innerHTML = template;
  const decodedTemplate = decoder.value;
  decodedFormatTemplates.set(template, decodedTemplate);

  return decodedTemplate;
}

function formatAmount(cents, format) {
  const numericCents = Number(cents);
  const amount = Number.isFinite(numericCents) ? numericCents / 100 : 0;
  const formattedAmount = Math.abs(amount).toFixed(format.precision);
  const [integer, fraction] = formattedAmount.split('.');
  const groupedInteger = integer.replace(/\B(?=(\d{3})+(?!\d))/g, format.thousands);
  const sign = amount < 0 ? '-' : '';
  const decimalPart = format.precision > 0 ? `${format.decimal}${fraction}` : '';

  return `${sign}${groupedInteger}${decimalPart}`;
}

function formatWithIntl(cents, { currency, currencyDisplay, locale }) {
  const amount = (Number(cents) || 0) / 100;

  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      currencyDisplay,
    }).format(amount);
  } catch (error) {
    return `${amount.toFixed(2)} ${currency || ''}`.trim();
  }
}

export function formatShopifyMoney(cents, formatTemplate, fallbackOptions = {}) {
  const template = decodeFormatTemplate(String(formatTemplate || ''));
  const placeholder = template.match(MONEY_PLACEHOLDER);

  if (!placeholder) return formatWithIntl(cents, fallbackOptions);

  return template.replace(MONEY_PLACEHOLDER, (_match, formatName) => {
    return formatAmount(cents, MONEY_FORMATS[formatName] || DEFAULT_MONEY_FORMAT);
  });
}
