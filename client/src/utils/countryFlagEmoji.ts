/**
 * Map farm / roster country labels to flag emoji (Unicode regional indicators).
 * Farm `country` is usually a full English name; also accepts ISO 3166-1 alpha-2.
 */

const REGIONAL_INDICATOR_A = 0x1f1e6;

function isoAlpha2ToFlagEmoji(iso2: string): string {
  const u = iso2.toUpperCase();
  if (u.length !== 2 || u[0] < 'A' || u[0] > 'Z' || u[1] < 'A' || u[1] > 'Z') return '';
  const cp = (ch: string) => REGIONAL_INDICATOR_A + (ch.charCodeAt(0) - 65);
  return String.fromCodePoint(cp(u[0]), cp(u[1]));
}

/** Lowercase ASCII-ish key: trim, de-accent, collapse non-alphanumerics to single spaces. */
export function normalizeCountryLookupKey(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * English short names and common aliases → ISO 3166-1 alpha-2.
 * Keys must match `normalizeCountryLookupKey` output.
 */
const COUNTRY_NAME_TO_ISO2: Record<string, string> = {
  afghanistan: 'AF',
  albania: 'AL',
  algeria: 'DZ',
  andorra: 'AD',
  angola: 'AO',
  'antigua and barbuda': 'AG',
  argentina: 'AR',
  armenia: 'AM',
  australia: 'AU',
  austria: 'AT',
  azerbaijan: 'AZ',
  bahamas: 'BS',
  bahrain: 'BH',
  bangladesh: 'BD',
  barbados: 'BB',
  belarus: 'BY',
  belgium: 'BE',
  belize: 'BZ',
  benin: 'BJ',
  bhutan: 'BT',
  bolivia: 'BO',
  'bosnia and herzegovina': 'BA',
  botswana: 'BW',
  brazil: 'BR',
  brunei: 'BN',
  bulgaria: 'BG',
  'burkina faso': 'BF',
  burundi: 'BI',
  cambodia: 'KH',
  cameroon: 'CM',
  canada: 'CA',
  'cape verde': 'CV',
  'central african republic': 'CF',
  chad: 'TD',
  chile: 'CL',
  china: 'CN',
  colombia: 'CO',
  comoros: 'KM',
  congo: 'CG',
  'democratic republic of the congo': 'CD',
  'republic of the congo': 'CG',
  drc: 'CD',
  'costa rica': 'CR',
  croatia: 'HR',
  cuba: 'CU',
  cyprus: 'CY',
  'czech republic': 'CZ',
  czechia: 'CZ',
  denmark: 'DK',
  djibouti: 'DJ',
  dominica: 'DM',
  'dominican republic': 'DO',
  ecuador: 'EC',
  egypt: 'EG',
  'el salvador': 'SV',
  'equatorial guinea': 'GQ',
  eritrea: 'ER',
  estonia: 'EE',
  eswatini: 'SZ',
  swaziland: 'SZ',
  ethiopia: 'ET',
  fiji: 'FJ',
  finland: 'FI',
  france: 'FR',
  gabon: 'GA',
  gambia: 'GM',
  georgia: 'GE',
  germany: 'DE',
  ghana: 'GH',
  greece: 'GR',
  grenada: 'GD',
  guatemala: 'GT',
  guinea: 'GN',
  'guinea bissau': 'GW',
  guyana: 'GY',
  haiti: 'HT',
  honduras: 'HN',
  hungary: 'HU',
  iceland: 'IS',
  india: 'IN',
  indonesia: 'ID',
  iran: 'IR',
  iraq: 'IQ',
  ireland: 'IE',
  israel: 'IL',
  italy: 'IT',
  'ivory coast': 'CI',
  'cote d ivoire': 'CI',
  jamaica: 'JM',
  japan: 'JP',
  jordan: 'JO',
  kazakhstan: 'KZ',
  kenya: 'KE',
  kiribati: 'KI',
  kosovo: 'XK',
  kuwait: 'KW',
  kyrgyzstan: 'KG',
  laos: 'LA',
  latvia: 'LV',
  lebanon: 'LB',
  lesotho: 'LS',
  liberia: 'LR',
  libya: 'LY',
  liechtenstein: 'LI',
  lithuania: 'LT',
  luxembourg: 'LU',
  madagascar: 'MG',
  malawi: 'MW',
  malaysia: 'MY',
  maldives: 'MV',
  mali: 'ML',
  malta: 'MT',
  'marshall islands': 'MH',
  mauritania: 'MR',
  mauritius: 'MU',
  mexico: 'MX',
  micronesia: 'FM',
  moldova: 'MD',
  monaco: 'MC',
  mongolia: 'MN',
  montenegro: 'ME',
  morocco: 'MA',
  mozambique: 'MZ',
  myanmar: 'MM',
  burma: 'MM',
  namibia: 'NA',
  nepal: 'NP',
  netherlands: 'NL',
  'the netherlands': 'NL',
  holland: 'NL',
  'new zealand': 'NZ',
  nicaragua: 'NI',
  niger: 'NE',
  nigeria: 'NG',
  'north korea': 'KP',
  'south korea': 'KR',
  korea: 'KR',
  'republic of korea': 'KR',
  macedonia: 'MK',
  'north macedonia': 'MK',
  norway: 'NO',
  oman: 'OM',
  pakistan: 'PK',
  palau: 'PW',
  palestine: 'PS',
  panama: 'PA',
  'papua new guinea': 'PG',
  paraguay: 'PY',
  peru: 'PE',
  philippines: 'PH',
  poland: 'PL',
  portugal: 'PT',
  qatar: 'QA',
  romania: 'RO',
  russia: 'RU',
  'russian federation': 'RU',
  rwanda: 'RW',
  'saint kitts and nevis': 'KN',
  'saint lucia': 'LC',
  'saint vincent and the grenadines': 'VC',
  samoa: 'WS',
  'san marino': 'SM',
  'sao tome and principe': 'ST',
  'saudi arabia': 'SA',
  senegal: 'SN',
  serbia: 'RS',
  seychelles: 'SC',
  'sierra leone': 'SL',
  singapore: 'SG',
  slovakia: 'SK',
  slovenia: 'SI',
  'solomon islands': 'SB',
  somalia: 'SO',
  'south africa': 'ZA',
  'south sudan': 'SS',
  spain: 'ES',
  'sri lanka': 'LK',
  sudan: 'SD',
  suriname: 'SR',
  sweden: 'SE',
  switzerland: 'CH',
  syria: 'SY',
  taiwan: 'TW',
  tajikistan: 'TJ',
  tanzania: 'TZ',
  thailand: 'TH',
  'timor leste': 'TL',
  'east timor': 'TL',
  togo: 'TG',
  tonga: 'TO',
  'trinidad and tobago': 'TT',
  tunisia: 'TN',
  turkey: 'TR',
  turkmenistan: 'TM',
  tuvalu: 'TV',
  uganda: 'UG',
  ukraine: 'UA',
  'united arab emirates': 'AE',
  uae: 'AE',
  'united kingdom': 'GB',
  uk: 'GB',
  'great britain': 'GB',
  england: 'GB',
  scotland: 'GB',
  wales: 'GB',
  'northern ireland': 'GB',
  'united states': 'US',
  usa: 'US',
  'united states of america': 'US',
  uruguay: 'UY',
  uzbekistan: 'UZ',
  vanuatu: 'VU',
  'vatican city': 'VA',
  venezuela: 'VE',
  vietnam: 'VN',
  'viet nam': 'VN',
  yemen: 'YE',
  zambia: 'ZM',
  zimbabwe: 'ZW',
  'puerto rico': 'PR',
  guam: 'GU',
  'us virgin islands': 'VI',
  'british virgin islands': 'VG',
  'cayman islands': 'KY',
  bermuda: 'BM',
  aruba: 'AW',
  'french guiana': 'GF',
  'french polynesia': 'PF',
  reunion: 'RE',
  martinique: 'MQ',
  guadeloupe: 'GP',
  curacao: 'CW',
  'curaçao': 'CW',
  'sint maarten': 'SX',
  'turks and caicos islands': 'TC',
  'falkland islands': 'FK',
  greenland: 'GL',
  'faroe islands': 'FO',
  gibraltar: 'GI',
  'hong kong': 'HK',
  macau: 'MO',
  macao: 'MO',
};

const ISO2_OVERRIDES: Record<string, string> = {
  uk: 'GB',
};

/**
 * Returns a Unicode flag emoji for a farm country label, or empty string if unknown.
 */
export function flagEmojiForCountryLabel(countryLabel: string): string {
  const raw = countryLabel.trim();
  if (!raw || raw === '—') return '';

  if (raw.length === 2 && /^[a-zA-Z]{2}$/.test(raw)) {
    const iso = (ISO2_OVERRIDES[raw.toLowerCase()] ?? raw).toUpperCase();
    return isoAlpha2ToFlagEmoji(iso);
  }

  const key = normalizeCountryLookupKey(raw);
  if (!key) return '';

  const iso = COUNTRY_NAME_TO_ISO2[key];
  if (iso) return isoAlpha2ToFlagEmoji(iso);

  const collapsed = key.replace(/\s+/g, '');
  for (const [k, code] of Object.entries(COUNTRY_NAME_TO_ISO2)) {
    if (k.replace(/\s+/g, '') === collapsed) return isoAlpha2ToFlagEmoji(code);
  }

  return '';
}
