/**
 * LinkedIn Bot Targeting Configuration
 *
 * Defines the targeting criteria for contact filtering:
 * - 1st degree connections only
 * - Europe and Americas regions
 * - Active users (activity within 90 days)
 */

import { TargetingConfig, TargetRegion } from '../types/linkedin.types';

/**
 * Main targeting configuration
 */
export const targetingConfig: TargetingConfig = {
  // Connection degree filter
  connectionDegree: '1st',

  // Target regions
  targetRegions: ['europe', 'americas'] as TargetRegion[],

  // Activity threshold
  activityThreshold: {
    maxInactiveDays: 90,      // Skip contacts inactive for 90+ days
    minimumActivityScore: 30,  // Minimum activity score to qualify
  },

  // Optional filters (null = don't filter)
  industries: null,
  companies: null,
  roles: null,
  excludeKeywords: ['recruiter', 'headhunter', 'talent acquisition'],

  // Country lists
  europeCountries: EUROPE_COUNTRIES,
  americasCountries: AMERICAS_COUNTRIES,
};

/**
 * European countries list
 */
export const EUROPE_COUNTRIES: string[] = [
  // Western Europe
  'United Kingdom',
  'UK',
  'England',
  'Scotland',
  'Wales',
  'Northern Ireland',
  'Germany',
  'France',
  'Spain',
  'Italy',
  'Portugal',
  'Netherlands',
  'Belgium',
  'Switzerland',
  'Austria',
  'Ireland',
  'Luxembourg',
  'Monaco',
  'Liechtenstein',
  'Andorra',

  // Northern Europe
  'Sweden',
  'Norway',
  'Denmark',
  'Finland',
  'Iceland',

  // Eastern Europe
  'Poland',
  'Czech Republic',
  'Czechia',
  'Hungary',
  'Romania',
  'Bulgaria',
  'Slovakia',
  'Slovenia',
  'Croatia',
  'Serbia',
  'Ukraine',
  'Estonia',
  'Latvia',
  'Lithuania',
  'Belarus',
  'Moldova',
  'Bosnia and Herzegovina',
  'Bosnia',
  'Herzegovina',
  'North Macedonia',
  'Macedonia',
  'Montenegro',
  'Albania',
  'Kosovo',

  // Southern Europe
  'Greece',
  'Cyprus',
  'Malta',
  'San Marino',
  'Vatican',
];

/**
 * Americas countries list
 */
export const AMERICAS_COUNTRIES: string[] = [
  // North America
  'United States',
  'USA',
  'US',
  'United States of America',
  'Canada',
  'Mexico',

  // Central America
  'Guatemala',
  'Costa Rica',
  'Panama',
  'Honduras',
  'El Salvador',
  'Nicaragua',
  'Belize',

  // South America
  'Brazil',
  'Argentina',
  'Colombia',
  'Chile',
  'Peru',
  'Venezuela',
  'Ecuador',
  'Bolivia',
  'Paraguay',
  'Uruguay',
  'Guyana',
  'Suriname',
  'French Guiana',

  // Caribbean
  'Puerto Rico',
  'Dominican Republic',
  'Jamaica',
  'Cuba',
  'Haiti',
  'Trinidad and Tobago',
  'Bahamas',
  'Barbados',
  'Saint Lucia',
  'Grenada',
  'Saint Vincent',
  'Antigua and Barbuda',
  'Dominica',
  'Saint Kitts and Nevis',
];

/**
 * Major cities that can be used for location detection
 * when only city name is provided
 */
export const MAJOR_CITIES: Record<string, string> = {
  // USA
  'New York': 'United States',
  'Los Angeles': 'United States',
  'Chicago': 'United States',
  'Houston': 'United States',
  'Phoenix': 'United States',
  'Philadelphia': 'United States',
  'San Antonio': 'United States',
  'San Diego': 'United States',
  'Dallas': 'United States',
  'San Jose': 'United States',
  'Austin': 'United States',
  'San Francisco': 'United States',
  'Seattle': 'United States',
  'Denver': 'United States',
  'Boston': 'United States',
  'Miami': 'United States',
  'Atlanta': 'United States',
  'Washington': 'United States',
  'Washington DC': 'United States',
  'Washington D.C.': 'United States',

  // Canada
  'Toronto': 'Canada',
  'Montreal': 'Canada',
  'Vancouver': 'Canada',
  'Calgary': 'Canada',
  'Ottawa': 'Canada',
  'Edmonton': 'Canada',

  // Mexico
  'Mexico City': 'Mexico',
  'Guadalajara': 'Mexico',
  'Monterrey': 'Mexico',

  // UK
  'London': 'United Kingdom',
  'Manchester': 'United Kingdom',
  'Birmingham': 'United Kingdom',
  'Leeds': 'United Kingdom',
  'Glasgow': 'United Kingdom',
  'Liverpool': 'United Kingdom',
  'Edinburgh': 'United Kingdom',
  'Bristol': 'United Kingdom',
  'Cambridge': 'United Kingdom',
  'Oxford': 'United Kingdom',

  // Germany
  'Berlin': 'Germany',
  'Munich': 'Germany',
  'Frankfurt': 'Germany',
  'Hamburg': 'Germany',
  'Cologne': 'Germany',
  'Dusseldorf': 'Germany',
  'Stuttgart': 'Germany',

  // France
  'Paris': 'France',
  'Lyon': 'France',
  'Marseille': 'France',
  'Toulouse': 'France',
  'Nice': 'France',
  'Bordeaux': 'France',

  // Spain
  'Madrid': 'Spain',
  'Barcelona': 'Spain',
  'Valencia': 'Spain',
  'Seville': 'Spain',
  'Bilbao': 'Spain',

  // Italy
  'Rome': 'Italy',
  'Milan': 'Italy',
  'Naples': 'Italy',
  'Turin': 'Italy',
  'Florence': 'Italy',

  // Netherlands
  'Amsterdam': 'Netherlands',
  'Rotterdam': 'Netherlands',
  'The Hague': 'Netherlands',

  // Belgium
  'Brussels': 'Belgium',
  'Antwerp': 'Belgium',

  // Switzerland
  'Zurich': 'Switzerland',
  'Geneva': 'Switzerland',
  'Basel': 'Switzerland',

  // Austria
  'Vienna': 'Austria',

  // Ireland
  'Dublin': 'Ireland',
  'Cork': 'Ireland',

  // Portugal
  'Lisbon': 'Portugal',
  'Porto': 'Portugal',

  // Sweden
  'Stockholm': 'Sweden',
  'Gothenburg': 'Sweden',

  // Norway
  'Oslo': 'Norway',

  // Denmark
  'Copenhagen': 'Denmark',

  // Finland
  'Helsinki': 'Finland',

  // Poland
  'Warsaw': 'Poland',
  'Krakow': 'Poland',
  'Wroclaw': 'Poland',

  // Czech Republic
  'Prague': 'Czech Republic',
  'Brno': 'Czech Republic',

  // Argentina
  'Buenos Aires': 'Argentina',
  'Cordoba': 'Argentina',
  'Rosario': 'Argentina',
  'Mendoza': 'Argentina',

  // Brazil
  'Sao Paulo': 'Brazil',
  'Rio de Janeiro': 'Brazil',
  'Brasilia': 'Brazil',
  'Belo Horizonte': 'Brazil',
  'Porto Alegre': 'Brazil',
  'Curitiba': 'Brazil',

  // Colombia
  'Bogota': 'Colombia',
  'Medellin': 'Colombia',
  'Cali': 'Colombia',
  'Barranquilla': 'Colombia',

  // Chile
  'Santiago': 'Chile',
  'Valparaiso': 'Chile',

  // Peru
  'Lima': 'Peru',

  // Venezuela
  'Caracas': 'Venezuela',

  // Ecuador
  'Quito': 'Ecuador',
  'Guayaquil': 'Ecuador',

  // Uruguay
  'Montevideo': 'Uruguay',

  // Greece
  'Athens': 'Greece',
  'Thessaloniki': 'Greece',

  // Romania
  'Bucharest': 'Romania',
  'Cluj-Napoca': 'Romania',

  // Hungary
  'Budapest': 'Hungary',

  // Ukraine
  'Kyiv': 'Ukraine',
  'Kiev': 'Ukraine',
  'Lviv': 'Ukraine',
  'Kharkiv': 'Ukraine',
};

/**
 * LinkedIn location patterns that indicate "Greater X Area"
 */
export const AREA_PATTERNS: { pattern: RegExp; country: string }[] = [
  // US Areas
  { pattern: /Greater New York/i, country: 'United States' },
  { pattern: /New York City Metropolitan Area/i, country: 'United States' },
  { pattern: /San Francisco Bay Area/i, country: 'United States' },
  { pattern: /Greater Los Angeles/i, country: 'United States' },
  { pattern: /Greater Chicago/i, country: 'United States' },
  { pattern: /Greater Boston/i, country: 'United States' },
  { pattern: /Greater Seattle/i, country: 'United States' },
  { pattern: /Greater Denver/i, country: 'United States' },
  { pattern: /Greater Atlanta/i, country: 'United States' },
  { pattern: /Greater Miami/i, country: 'United States' },
  { pattern: /Greater Philadelphia/i, country: 'United States' },
  { pattern: /Greater Washington/i, country: 'United States' },
  { pattern: /Greater Dallas/i, country: 'United States' },
  { pattern: /Greater Houston/i, country: 'United States' },
  { pattern: /Greater Phoenix/i, country: 'United States' },
  { pattern: /, CA$/i, country: 'United States' },
  { pattern: /, NY$/i, country: 'United States' },
  { pattern: /, TX$/i, country: 'United States' },
  { pattern: /, FL$/i, country: 'United States' },
  { pattern: /, WA$/i, country: 'United States' },
  { pattern: /, IL$/i, country: 'United States' },
  { pattern: /, MA$/i, country: 'United States' },
  { pattern: /, PA$/i, country: 'United States' },
  { pattern: /, GA$/i, country: 'United States' },
  { pattern: /, CO$/i, country: 'United States' },

  // UK Areas
  { pattern: /Greater London/i, country: 'United Kingdom' },
  { pattern: /Greater Manchester/i, country: 'United Kingdom' },
  { pattern: /West Midlands/i, country: 'United Kingdom' },
  { pattern: /Greater Birmingham/i, country: 'United Kingdom' },
  { pattern: /, England$/i, country: 'United Kingdom' },
  { pattern: /, Scotland$/i, country: 'United Kingdom' },
  { pattern: /, Wales$/i, country: 'United Kingdom' },

  // Canada Areas
  { pattern: /Greater Toronto/i, country: 'Canada' },
  { pattern: /Greater Vancouver/i, country: 'Canada' },
  { pattern: /Greater Montreal/i, country: 'Canada' },

  // Europe regions
  { pattern: /Ile-de-France/i, country: 'France' },
  { pattern: /Lombardy/i, country: 'Italy' },
  { pattern: /Catalonia/i, country: 'Spain' },
  { pattern: /Community of Madrid/i, country: 'Spain' },
  { pattern: /North Rhine-Westphalia/i, country: 'Germany' },
  { pattern: /Bavaria/i, country: 'Germany' },
  { pattern: /Baden-Wurttemberg/i, country: 'Germany' },
  { pattern: /North Holland/i, country: 'Netherlands' },
  { pattern: /South Holland/i, country: 'Netherlands' },

  // South America
  { pattern: /Greater Buenos Aires/i, country: 'Argentina' },
  { pattern: /Metropolitan Area of Buenos Aires/i, country: 'Argentina' },
  { pattern: /Greater Sao Paulo/i, country: 'Brazil' },
  { pattern: /Greater Rio/i, country: 'Brazil' },
];

/**
 * Country name normalizations (alternative spellings/names)
 */
export const COUNTRY_ALIASES: Record<string, string> = {
  // USA variations
  'United States of America': 'United States',
  'USA': 'United States',
  'US': 'United States',
  'U.S.': 'United States',
  'U.S.A.': 'United States',
  'America': 'United States',

  // UK variations
  'UK': 'United Kingdom',
  'U.K.': 'United Kingdom',
  'Britain': 'United Kingdom',
  'Great Britain': 'United Kingdom',
  'England': 'United Kingdom',
  'Scotland': 'United Kingdom',
  'Wales': 'United Kingdom',
  'Northern Ireland': 'United Kingdom',

  // Czech variations
  'Czechia': 'Czech Republic',
  'Czech': 'Czech Republic',

  // Netherlands variations
  'Holland': 'Netherlands',
  'The Netherlands': 'Netherlands',

  // Other common variations
  'Brasil': 'Brazil',
  'Espana': 'Spain',
  'Deutschland': 'Germany',
  'Italia': 'Italy',
  'Suisse': 'Switzerland',
  'Schweiz': 'Switzerland',
  'Osterreich': 'Austria',
  'Sverige': 'Sweden',
  'Norge': 'Norway',
  'Danmark': 'Denmark',
  'Suomi': 'Finland',
  'Polska': 'Poland',
  'Magyarorszag': 'Hungary',
  'Hellas': 'Greece',
  'Ellas': 'Greece',
};

/**
 * Check if a country is in the target region
 */
export function isTargetCountry(country: string): boolean {
  const normalizedCountry = COUNTRY_ALIASES[country] || country;

  return (
    EUROPE_COUNTRIES.some(c => c.toLowerCase() === normalizedCountry.toLowerCase()) ||
    AMERICAS_COUNTRIES.some(c => c.toLowerCase() === normalizedCountry.toLowerCase())
  );
}

/**
 * Get region for a country
 */
export function getRegionForCountry(country: string): 'europe' | 'americas' | 'other' {
  const normalizedCountry = COUNTRY_ALIASES[country] || country;

  if (EUROPE_COUNTRIES.some(c => c.toLowerCase() === normalizedCountry.toLowerCase())) {
    return 'europe';
  }

  if (AMERICAS_COUNTRIES.some(c => c.toLowerCase() === normalizedCountry.toLowerCase())) {
    return 'americas';
  }

  return 'other';
}
