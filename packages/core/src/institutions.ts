import type { AccountType, Institution } from './types';

const BANK: AccountType[] = ['debit', 'credit', 'savings', 'loan'];
const BANK_INV: AccountType[] = ['debit', 'credit', 'savings', 'loan', 'investment'];
const BROKER: AccountType[] = ['investment'];
const BROKER_CRYPTO: AccountType[] = ['investment', 'crypto'];
const CRYPTO: AccountType[] = ['crypto'];
const NEOBANK: AccountType[] = ['debit', 'savings', 'credit', 'investment', 'crypto'];
const LENDER: AccountType[] = ['loan', 'credit'];

const i = (id: string, name: string, color: string, domain: string, types: AccountType[]): Institution => ({
  id,
  name,
  color,
  domain,
  types,
});

export interface Country {
  code: string;
  name: string;
  currency: string;
  flag: string;
}

export const COUNTRIES: Country[] = [
  { code: 'RO', name: 'Romania', currency: 'RON', flag: '🇷🇴' },
  { code: 'MD', name: 'Moldova', currency: 'MDL', flag: '🇲🇩' },
  { code: 'US', name: 'United States', currency: 'USD', flag: '🇺🇸' },
  { code: 'GB', name: 'United Kingdom', currency: 'GBP', flag: '🇬🇧' },
  { code: 'DE', name: 'Germany', currency: 'EUR', flag: '🇩🇪' },
  { code: 'FR', name: 'France', currency: 'EUR', flag: '🇫🇷' },
  { code: 'ES', name: 'Spain', currency: 'EUR', flag: '🇪🇸' },
  { code: 'IT', name: 'Italy', currency: 'EUR', flag: '🇮🇹' },
  { code: 'NL', name: 'Netherlands', currency: 'EUR', flag: '🇳🇱' },
  { code: 'AT', name: 'Austria', currency: 'EUR', flag: '🇦🇹' },
  { code: 'IE', name: 'Ireland', currency: 'EUR', flag: '🇮🇪' },
  { code: 'PL', name: 'Poland', currency: 'PLN', flag: '🇵🇱' },
  { code: 'HU', name: 'Hungary', currency: 'HUF', flag: '🇭🇺' },
  { code: 'BG', name: 'Bulgaria', currency: 'BGN', flag: '🇧🇬' },
  { code: 'CH', name: 'Switzerland', currency: 'CHF', flag: '🇨🇭' },
  { code: 'CA', name: 'Canada', currency: 'CAD', flag: '🇨🇦' },
];

/** Available in many countries; shown alongside the country-specific list. */
export const GLOBAL_INSTITUTIONS: Institution[] = [
  i('revolut', 'Revolut', '#191C1F', 'revolut.com', NEOBANK),
  i('wise', 'Wise', '#9FE870', 'wise.com', ['debit', 'savings']),
  i('n26', 'N26', '#36A18B', 'n26.com', ['debit', 'savings', 'credit']),
  i('paypal', 'PayPal', '#003087', 'paypal.com', ['debit']),
  i('ibkr', 'Interactive Brokers', '#D81222', 'interactivebrokers.com', BROKER),
  i('trading212', 'Trading 212', '#1B9CFC', 'trading212.com', BROKER),
  i('etoro', 'eToro', '#13C636', 'etoro.com', BROKER_CRYPTO),
  i('xtb', 'XTB', '#E2231A', 'xtb.com', BROKER),
  i('degiro', 'DEGIRO', '#00A3E0', 'degiro.com', BROKER),
  i('binance', 'Binance', '#F0B90B', 'binance.com', CRYPTO),
  i('coinbase', 'Coinbase', '#0052FF', 'coinbase.com', CRYPTO),
  i('kraken', 'Kraken', '#5741D9', 'kraken.com', CRYPTO),
  i('bitpanda', 'Bitpanda', '#2ABF7C', 'bitpanda.com', BROKER_CRYPTO),
  i('ledger', 'Ledger (self-custody)', '#000000', 'ledger.com', CRYPTO),
  i('metamask', 'MetaMask', '#F6851B', 'metamask.io', CRYPTO),
];

export const INSTITUTIONS_BY_COUNTRY: Record<string, Institution[]> = {
  RO: [
    i('ro-bt', 'Banca Transilvania', '#005EB8', 'bancatransilvania.ro', BANK_INV),
    i('ro-bcr', 'BCR', '#0B3B7C', 'bcr.ro', BANK_INV),
    i('ro-brd', 'BRD - Groupe Société Générale', '#E60028', 'brd.ro', BANK_INV),
    i('ro-ing', 'ING Bank România', '#FF6200', 'ing.ro', BANK_INV),
    i('ro-raiffeisen', 'Raiffeisen Bank', '#FFE600', 'raiffeisen.ro', BANK_INV),
    i('ro-cec', 'CEC Bank', '#00529B', 'cec.ro', BANK),
    i('ro-unicredit', 'UniCredit Bank', '#E2001A', 'unicredit.ro', BANK_INV),
    i('ro-garanti', 'Garanti BBVA', '#00A19A', 'garantibbva.ro', BANK),
    i('ro-libra', 'Libra Internet Bank', '#00B2A9', 'librabank.ro', BANK),
    i('ro-exim', 'Exim Banca Românească', '#003B71', 'eximbank.ro', BANK),
    i('ro-salt', 'Salt Bank', '#111111', 'saltbank.ro', BANK),
    i('ro-otp', 'OTP Bank', '#52AE30', 'otpbank.ro', BANK),
    i('ro-tbi', 'TBI Bank', '#FF5A00', 'tbibank.ro', LENDER),
    i('ro-tradeville', 'Tradeville', '#004B87', 'tradeville.ro', BROKER),
    i('ro-bvb', 'BT Capital Partners', '#005EB8', 'btcapitalpartners.ro', BROKER),
  ],
  MD: [
    i('md-maib', 'maib', '#00B0A9', 'maib.md', BANK),
    i('md-mici', 'Moldindconbank', '#004A99', 'micb.md', BANK),
    i('md-victoria', 'Victoriabank', '#E30613', 'victoriabank.md', BANK),
    i('md-otp', 'OTP Bank Moldova', '#52AE30', 'otpbank.md', BANK),
  ],
  US: [
    i('us-chase', 'Chase', '#117ACA', 'chase.com', BANK_INV),
    i('us-boa', 'Bank of America', '#E31837', 'bankofamerica.com', BANK_INV),
    i('us-wells', 'Wells Fargo', '#D71E28', 'wellsfargo.com', BANK_INV),
    i('us-citi', 'Citi', '#003B70', 'citi.com', BANK_INV),
    i('us-capone', 'Capital One', '#004977', 'capitalone.com', BANK),
    i('us-amex', 'American Express', '#2E77BC', 'americanexpress.com', ['credit', 'savings']),
    i('us-discover', 'Discover', '#FF6000', 'discover.com', ['credit', 'savings', 'loan']),
    i('us-ally', 'Ally Bank', '#650360', 'ally.com', BANK_INV),
    i('us-usbank', 'U.S. Bank', '#0C2074', 'usbank.com', BANK),
    i('us-schwab', 'Charles Schwab', '#00A0DF', 'schwab.com', BROKER),
    i('us-fidelity', 'Fidelity', '#368727', 'fidelity.com', BROKER),
    i('us-vanguard', 'Vanguard', '#96151D', 'vanguard.com', BROKER),
    i('us-robinhood', 'Robinhood', '#00C805', 'robinhood.com', BROKER_CRYPTO),
    i('us-sofi', 'SoFi', '#00A9CE', 'sofi.com', NEOBANK),
  ],
  GB: [
    i('gb-barclays', 'Barclays', '#00AEEF', 'barclays.co.uk', BANK_INV),
    i('gb-hsbc', 'HSBC UK', '#DB0011', 'hsbc.co.uk', BANK_INV),
    i('gb-lloyds', 'Lloyds Bank', '#006A4D', 'lloydsbank.com', BANK),
    i('gb-natwest', 'NatWest', '#42145F', 'natwest.com', BANK),
    i('gb-santander', 'Santander UK', '#EC0000', 'santander.co.uk', BANK),
    i('gb-nationwide', 'Nationwide', '#1A1F71', 'nationwide.co.uk', BANK),
    i('gb-monzo', 'Monzo', '#FF4F40', 'monzo.com', NEOBANK),
    i('gb-starling', 'Starling Bank', '#7433FF', 'starlingbank.com', BANK),
    i('gb-chase', 'Chase UK', '#117ACA', 'chase.co.uk', ['debit', 'savings']),
    i('gb-vanguard', 'Vanguard UK', '#96151D', 'vanguardinvestor.co.uk', BROKER),
    i('gb-hl', 'Hargreaves Lansdown', '#00205B', 'hl.co.uk', BROKER),
  ],
  DE: [
    i('de-deutsche', 'Deutsche Bank', '#0018A8', 'deutsche-bank.de', BANK_INV),
    i('de-commerz', 'Commerzbank', '#FFCC00', 'commerzbank.de', BANK_INV),
    i('de-sparkasse', 'Sparkasse', '#FF0000', 'sparkasse.de', BANK_INV),
    i('de-volksbank', 'Volksbank / Raiffeisenbank', '#0066B3', 'vr.de', BANK_INV),
    i('de-ing', 'ING Deutschland', '#FF6200', 'ing.de', BANK_INV),
    i('de-dkb', 'DKB', '#148DEA', 'dkb.de', BANK_INV),
    i('de-comdirect', 'comdirect', '#FFF500', 'comdirect.de', BANK_INV),
    i('de-traderepublic', 'Trade Republic', '#000000', 'traderepublic.com', BROKER_CRYPTO),
    i('de-scalable', 'Scalable Capital', '#28D4C4', 'scalable.capital', BROKER),
  ],
  FR: [
    i('fr-bnp', 'BNP Paribas', '#00915A', 'bnpparibas.fr', BANK_INV),
    i('fr-ca', 'Crédit Agricole', '#009597', 'credit-agricole.fr', BANK_INV),
    i('fr-sg', 'Société Générale', '#E60028', 'societegenerale.fr', BANK_INV),
    i('fr-lcl', 'LCL', '#0A2A73', 'lcl.fr', BANK),
    i('fr-boursobank', 'BoursoBank', '#D6006E', 'boursobank.com', BANK_INV),
    i('fr-cm', 'Crédit Mutuel', '#E2001A', 'creditmutuel.fr', BANK),
    i('fr-lbp', 'La Banque Postale', '#004B9B', 'labanquepostale.fr', BANK),
  ],
  ES: [
    i('es-santander', 'Santander', '#EC0000', 'santander.es', BANK_INV),
    i('es-bbva', 'BBVA', '#004481', 'bbva.es', BANK_INV),
    i('es-caixa', 'CaixaBank', '#007EAE', 'caixabank.es', BANK_INV),
    i('es-sabadell', 'Banco Sabadell', '#006DFF', 'bancsabadell.com', BANK),
    i('es-ing', 'ING España', '#FF6200', 'ing.es', BANK_INV),
    i('es-openbank', 'Openbank', '#EC0000', 'openbank.es', BANK_INV),
  ],
  IT: [
    i('it-intesa', 'Intesa Sanpaolo', '#006A3B', 'intesasanpaolo.com', BANK_INV),
    i('it-unicredit', 'UniCredit', '#E2001A', 'unicredit.it', BANK_INV),
    i('it-fineco', 'Fineco', '#00366F', 'finecobank.com', BANK_INV),
    i('it-bpm', 'Banco BPM', '#00539B', 'bancobpm.it', BANK),
    i('it-poste', 'Poste Italiane', '#FFE000', 'poste.it', BANK),
  ],
  NL: [
    i('nl-ing', 'ING', '#FF6200', 'ing.nl', BANK_INV),
    i('nl-rabo', 'Rabobank', '#000099', 'rabobank.nl', BANK_INV),
    i('nl-abn', 'ABN AMRO', '#009286', 'abnamro.nl', BANK_INV),
    i('nl-bunq', 'bunq', '#3394D7', 'bunq.com', NEOBANK),
    i('nl-sns', 'SNS', '#4E2A84', 'snsbank.nl', BANK),
  ],
  AT: [
    i('at-erste', 'Erste Bank', '#2870ED', 'sparkasse.at', BANK_INV),
    i('at-raiffeisen', 'Raiffeisen', '#FFE600', 'raiffeisen.at', BANK_INV),
    i('at-bawag', 'BAWAG', '#00A0DC', 'bawag.at', BANK),
    i('at-george', 'George (Erste)', '#2870ED', 'george.at', BANK),
  ],
  IE: [
    i('ie-aib', 'AIB', '#7F2B7B', 'aib.ie', BANK),
    i('ie-boi', 'Bank of Ireland', '#0000AA', 'bankofireland.com', BANK),
    i('ie-ptsb', 'PTSB', '#6A1B9A', 'ptsb.ie', BANK),
  ],
  PL: [
    i('pl-pko', 'PKO Bank Polski', '#003574', 'pkobp.pl', BANK_INV),
    i('pl-pekao', 'Bank Pekao', '#C8102E', 'pekao.com.pl', BANK_INV),
    i('pl-mbank', 'mBank', '#E30613', 'mbank.pl', BANK_INV),
    i('pl-santander', 'Santander Bank Polska', '#EC0000', 'santander.pl', BANK),
    i('pl-ing', 'ING Bank Śląski', '#FF6200', 'ing.pl', BANK_INV),
  ],
  HU: [
    i('hu-otp', 'OTP Bank', '#52AE30', 'otpbank.hu', BANK_INV),
    i('hu-kh', 'K&H Bank', '#0071BC', 'kh.hu', BANK),
    i('hu-mbh', 'MBH Bank', '#0A3C6E', 'mbhbank.hu', BANK),
  ],
  BG: [
    i('bg-dsk', 'DSK Bank', '#00843D', 'dskbank.bg', BANK),
    i('bg-unicredit', 'UniCredit Bulbank', '#E2001A', 'unicreditbulbank.bg', BANK),
    i('bg-ubb', 'UBB', '#003B6F', 'ubb.bg', BANK),
    i('bg-fibank', 'Fibank', '#F7A600', 'fibank.bg', BANK),
  ],
  CH: [
    i('ch-ubs', 'UBS', '#E60000', 'ubs.com', BANK_INV),
    i('ch-postfinance', 'PostFinance', '#FFCC00', 'postfinance.ch', BANK_INV),
    i('ch-raiffeisen', 'Raiffeisen Schweiz', '#FFE600', 'raiffeisen.ch', BANK),
    i('ch-zkb', 'Zürcher Kantonalbank', '#0064A8', 'zkb.ch', BANK_INV),
    i('ch-neon', 'neon', '#FF7E9C', 'neon-free.ch', ['debit']),
  ],
  CA: [
    i('ca-rbc', 'RBC Royal Bank', '#005DAA', 'rbcroyalbank.com', BANK_INV),
    i('ca-td', 'TD Canada Trust', '#008A00', 'td.com', BANK_INV),
    i('ca-scotia', 'Scotiabank', '#EC111A', 'scotiabank.com', BANK_INV),
    i('ca-bmo', 'BMO', '#0079C1', 'bmo.com', BANK_INV),
    i('ca-cibc', 'CIBC', '#C41F3E', 'cibc.com', BANK_INV),
    i('ca-wealthsimple', 'Wealthsimple', '#000000', 'wealthsimple.com', BROKER_CRYPTO),
  ],
};

/** Institutions a user can pick for an account of `type` in `country`. */
export function institutionsFor(country: string, type?: AccountType): Institution[] {
  const list = [...(INSTITUTIONS_BY_COUNTRY[country] ?? []), ...GLOBAL_INSTITUTIONS];
  return type ? list.filter((inst) => inst.types.includes(type)) : list;
}

export function findInstitution(id: string | null | undefined): Institution | undefined {
  if (!id) return undefined;
  for (const list of Object.values(INSTITUTIONS_BY_COUNTRY)) {
    const hit = list.find((inst) => inst.id === id);
    if (hit) return hit;
  }
  return GLOBAL_INSTITUTIONS.find((inst) => inst.id === id);
}

export function countryByCode(code: string): Country | undefined {
  return COUNTRIES.find((c) => c.code === code);
}
