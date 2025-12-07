/**
 * Location Parser Service
 *
 * Parses LinkedIn location strings and determines if they're in target regions
 * (Europe or Americas).
 */

import {
  EUROPE_COUNTRIES,
  AMERICAS_COUNTRIES,
  MAJOR_CITIES,
  AREA_PATTERNS,
  COUNTRY_ALIASES,
  isTargetCountry,
  getRegionForCountry,
} from '../../config/targeting.config';
import { LocationInfo, TargetRegion } from '../../types/linkedin.types';

export class LocationParserService {
  private cityToCountryCache: Map<string, string> = new Map();

  constructor() {
    // Pre-populate cache with known cities
    for (const [city, country] of Object.entries(MAJOR_CITIES)) {
      this.cityToCountryCache.set(city.toLowerCase(), country);
    }
    console.log(`LocationParserService initialized with ${this.cityToCountryCache.size} known cities`);
  }

  /**
   * Parse a LinkedIn location string into structured location info
   */
  parseLocation(locationString: string | null | undefined): LocationInfo {
    const result: LocationInfo = {
      raw: locationString || '',
      country: null,
      city: null,
      region: 'unknown',
      isTargetRegion: false,
      confidence: 0,
    };

    if (!locationString || locationString.trim() === '') {
      return result;
    }

    const normalized = locationString.trim();
    result.raw = normalized;

    // Try different parsing strategies in order of reliability

    // Strategy 1: Check for "Greater X Area" patterns
    const areaMatch = this.matchAreaPattern(normalized);
    if (areaMatch) {
      result.country = areaMatch;
      result.region = getRegionForCountry(areaMatch);
      result.isTargetRegion = isTargetCountry(areaMatch);
      result.confidence = 0.9;
      return result;
    }

    // Strategy 2: Direct country match in the string
    const directCountry = this.findCountryInString(normalized);
    if (directCountry) {
      result.country = directCountry;
      result.region = getRegionForCountry(directCountry);
      result.isTargetRegion = isTargetCountry(directCountry);
      result.confidence = 0.95;
      return result;
    }

    // Strategy 3: Parse comma-separated location (City, State/Region, Country)
    const parts = normalized.split(',').map(p => p.trim());

    if (parts.length >= 1) {
      // Check last part first (most likely to be country)
      for (let i = parts.length - 1; i >= 0; i--) {
        const part = parts[i].trim();
        const country = this.normalizeCountry(part);
        if (country) {
          result.country = country;
          result.region = getRegionForCountry(country);
          result.isTargetRegion = isTargetCountry(country);
          result.confidence = 0.9 - (parts.length - 1 - i) * 0.1;
          if (i > 0) {
            result.city = parts[0].trim();
          }
          return result;
        }
      }

      // Check for US state abbreviations
      if (parts.length >= 2) {
        const stateAbbr = parts[parts.length - 1].trim().toUpperCase();
        if (this.isUSStateAbbreviation(stateAbbr)) {
          result.country = 'United States';
          result.city = parts[0].trim();
          result.region = 'americas';
          result.isTargetRegion = true;
          result.confidence = 0.85;
          return result;
        }
      }
    }

    // Strategy 4: City lookup
    const cityMatch = this.lookupCity(normalized);
    if (cityMatch) {
      result.country = cityMatch.country;
      result.city = cityMatch.city;
      result.region = getRegionForCountry(cityMatch.country);
      result.isTargetRegion = isTargetCountry(cityMatch.country);
      result.confidence = 0.7;
      return result;
    }

    // Strategy 5: Check for city in parts
    for (const part of parts) {
      const cityLookup = this.lookupCity(part.trim());
      if (cityLookup) {
        result.country = cityLookup.country;
        result.city = cityLookup.city;
        result.region = getRegionForCountry(cityLookup.country);
        result.isTargetRegion = isTargetCountry(cityLookup.country);
        result.confidence = 0.6;
        return result;
      }
    }

    // Could not determine location
    result.confidence = 0;
    return result;
  }

  /**
   * Check if location matches any "Greater X Area" patterns
   */
  private matchAreaPattern(location: string): string | null {
    for (const { pattern, country } of AREA_PATTERNS) {
      if (pattern.test(location)) {
        return country;
      }
    }
    return null;
  }

  /**
   * Find a country name directly in the location string
   */
  private findCountryInString(location: string): string | null {
    const lowerLocation = location.toLowerCase();

    // Check Europe countries
    for (const country of EUROPE_COUNTRIES) {
      if (lowerLocation.includes(country.toLowerCase())) {
        return country;
      }
    }

    // Check Americas countries
    for (const country of AMERICAS_COUNTRIES) {
      if (lowerLocation.includes(country.toLowerCase())) {
        return country;
      }
    }

    // Check country aliases
    for (const [alias, country] of Object.entries(COUNTRY_ALIASES)) {
      if (lowerLocation.includes(alias.toLowerCase())) {
        return country;
      }
    }

    return null;
  }

  /**
   * Normalize country name using aliases
   */
  private normalizeCountry(countryString: string): string | null {
    const normalized = countryString.trim();

    // Check aliases first
    if (COUNTRY_ALIASES[normalized]) {
      return COUNTRY_ALIASES[normalized];
    }

    // Check exact match in Europe
    for (const country of EUROPE_COUNTRIES) {
      if (country.toLowerCase() === normalized.toLowerCase()) {
        return country;
      }
    }

    // Check exact match in Americas
    for (const country of AMERICAS_COUNTRIES) {
      if (country.toLowerCase() === normalized.toLowerCase()) {
        return country;
      }
    }

    return null;
  }

  /**
   * Check if string is a US state abbreviation
   */
  private isUSStateAbbreviation(abbr: string): boolean {
    const usStates = [
      'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
      'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
      'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
      'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
      'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY',
      'DC', 'PR', 'VI', 'GU', 'AS', 'MP'
    ];
    return usStates.includes(abbr);
  }

  /**
   * Look up a city and return its country
   */
  private lookupCity(cityString: string): { city: string; country: string } | null {
    const normalized = cityString.trim().toLowerCase();

    // Remove common suffixes
    const cleanCity = normalized
      .replace(/\s*(metropolitan\s*)?area$/i, '')
      .replace(/\s*greater\s*/i, '')
      .replace(/\s*region$/i, '')
      .trim();

    // Check cache
    if (this.cityToCountryCache.has(cleanCity)) {
      return {
        city: cityString,
        country: this.cityToCountryCache.get(cleanCity)!,
      };
    }

    // Check MAJOR_CITIES
    for (const [city, country] of Object.entries(MAJOR_CITIES)) {
      if (city.toLowerCase() === cleanCity) {
        this.cityToCountryCache.set(cleanCity, country);
        return { city, country };
      }
    }

    return null;
  }

  /**
   * Check if a location is in target regions (Europe or Americas)
   */
  isInTargetRegion(locationString: string | null | undefined): boolean {
    const parsed = this.parseLocation(locationString);
    return parsed.isTargetRegion && parsed.confidence >= 0.5;
  }

  /**
   * Get region for a location string
   */
  getRegion(locationString: string | null | undefined): TargetRegion {
    const parsed = this.parseLocation(locationString);
    return parsed.region;
  }

  /**
   * Batch parse multiple locations
   */
  parseLocations(locations: (string | null | undefined)[]): LocationInfo[] {
    return locations.map(loc => this.parseLocation(loc));
  }

  /**
   * Get statistics about parsed locations
   */
  getLocationStats(locations: LocationInfo[]): {
    total: number;
    europe: number;
    americas: number;
    other: number;
    unknown: number;
    targetRegion: number;
    avgConfidence: number;
  } {
    const stats = {
      total: locations.length,
      europe: 0,
      americas: 0,
      other: 0,
      unknown: 0,
      targetRegion: 0,
      avgConfidence: 0,
    };

    let totalConfidence = 0;

    for (const loc of locations) {
      switch (loc.region) {
        case 'europe':
          stats.europe++;
          break;
        case 'americas':
          stats.americas++;
          break;
        case 'other':
          stats.other++;
          break;
        default:
          stats.unknown++;
      }

      if (loc.isTargetRegion) {
        stats.targetRegion++;
      }

      totalConfidence += loc.confidence;
    }

    stats.avgConfidence = locations.length > 0 ? totalConfidence / locations.length : 0;

    return stats;
  }
}

// Export singleton instance
export const locationParserService = new LocationParserService();
