import { describe, it, expect } from 'vitest'
import {
  slugify,
  modulePath,
  documentsPath,
  moneyPath,
  foodRecipePhotosPath,
  homePath,
  travelTripPath,
  wardrobePath,
  calendarAttachmentsPath,
} from '@/lib/drive/folders'

describe('drive/folders — pure path builders (§5.4)', () => {
  it('builds top-level module paths', () => {
    expect(modulePath('Money')).toBe('/HomeApp/Money')
    expect(modulePath('Documents')).toBe('/HomeApp/Documents')
    expect(modulePath('Calendar')).toBe('/HomeApp/Calendar')
  })

  it('builds Documents subcategory paths', () => {
    expect(documentsPath('IDs')).toBe('/HomeApp/Documents/IDs')
    expect(documentsPath('Passports')).toBe('/HomeApp/Documents/Passports')
    expect(documentsPath('Warranties')).toBe('/HomeApp/Documents/Warranties')
    expect(documentsPath('Car')).toBe('/HomeApp/Documents/Car')
    expect(documentsPath('Other')).toBe('/HomeApp/Documents/Other')
  })

  it('builds Money subcategory paths', () => {
    expect(moneyPath('Receipts')).toBe('/HomeApp/Money/Receipts')
    expect(moneyPath('Bills')).toBe('/HomeApp/Money/Bills')
  })

  it('builds the Food recipe-photos path', () => {
    expect(foodRecipePhotosPath()).toBe('/HomeApp/Food/RecipePhotos')
  })

  it('builds Home subcategory paths', () => {
    expect(homePath('MaintenanceDocs')).toBe('/HomeApp/Home/MaintenanceDocs')
    expect(homePath('HomeProjects')).toBe('/HomeApp/Home/HomeProjects')
  })

  it('builds Travel trip paths with TripId prefix + slug', () => {
    expect(travelTripPath('42', 'Cape Town Getaway')).toBe(
      '/HomeApp/Travel/42-cape-town-getaway',
    )
  })

  it('disambiguates same-named trips by id prefix', () => {
    const a = travelTripPath('aaa', 'Beach Trip')
    const b = travelTripPath('bbb', 'Beach Trip')
    expect(a).not.toBe(b)
    expect(a).toBe('/HomeApp/Travel/aaa-beach-trip')
    expect(b).toBe('/HomeApp/Travel/bbb-beach-trip')
  })

  it('builds per-user Wardrobe paths', () => {
    expect(wardrobePath('user-123')).toBe('/HomeApp/Wardrobe/user-123')
  })

  it('builds the Calendar attachments path', () => {
    expect(calendarAttachmentsPath()).toBe('/HomeApp/Calendar/Attachments')
  })
})

describe('drive/folders — slugify', () => {
  it('lowercases and hyphenates', () => {
    expect(slugify('Cape Town')).toBe('cape-town')
  })

  it('collapses runs of non-alphanumerics', () => {
    expect(slugify('A  --  B!!!C')).toBe('a-b-c')
  })

  it('strips leading/trailing separators', () => {
    expect(slugify('  -Hello-  ')).toBe('hello')
  })

  it('strips diacritics', () => {
    expect(slugify('Café Déjà')).toBe('cafe-deja')
  })

  it('falls back to "untitled" for empty/symbol-only input', () => {
    expect(slugify('')).toBe('untitled')
    expect(slugify('!!!')).toBe('untitled')
  })
})
