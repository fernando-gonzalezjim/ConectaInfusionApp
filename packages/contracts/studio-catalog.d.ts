import type {Locale,StudioDiscipline} from './index';
export interface StudioClass extends Omit<StudioDiscipline,'id'> {
  id:string;disciplineId:string;audience:'children'|'adults';minAge:number|null;maxAge:number|null;
  level:'beginner'|'intermediate'|'advanced'|'all';color:string;durationMinutes:55;
}
export interface StudioClassInput {
  disciplineId:string;nameEs:string;nameEn?:string|null;descriptionEs?:string;descriptionEn?:string|null;
  audience:StudioClass['audience'];minAge?:number|null;maxAge?:number|null;level:StudioClass['level'];color?:string;
  status?:'draft'|'published';
}
export interface StudioClassUpdate extends Partial<Omit<StudioClassInput,'status'>> {status?:StudioClass['status'];expectedVersion:number;reason?:string}
export interface StudioInstructor {
  instructorId:string;publicName:string;biographyEs:string|null;biographyEn:string|null;
  status:StudioDiscipline['status'];version:number;disciplineIds:string[];photo:{url:string;altEs:string;altEn:string|null}|null;
}
export interface StudioInstructorInput {
  instructorId:string;publicName:string;biographyEs?:string|null;biographyEn?:string|null;
  status?:'draft'|'published';disciplineIds:string[];
}
export interface StudioInstructorUpdate extends Partial<Omit<StudioInstructorInput,'instructorId'|'status'>> {status?:StudioInstructor['status'];expectedVersion:number;reason?:string}
export interface CatalogPage<T> {items:T[];nextCursor:string|null}
export interface PublicDiscipline {id:string;name:string;description:string}
export interface PublicInstructor {id:string;publicName:string;biography:string|null;photo:{url:string;alt:string}|null}
export interface PublicStudioClass {
  id:string;discipline:PublicDiscipline;name:string;description:string;audience:StudioClass['audience'];
  minAge:number|null;maxAge:number|null;level:StudioClass['level'];color:string;durationMinutes:55;instructors:PublicInstructor[];
}
export interface CatalogQuery {limit?:number;cursor?:string;locale?:Locale;disciplineId?:string}
