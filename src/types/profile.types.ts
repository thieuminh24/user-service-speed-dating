// src/types/profile.types.ts  ← Tạo file này
import {
  Drinking,
  EducationLevel,
  Exercise,
  Kids,
  LookingFor,
  Politics,
  Religion,
  Smoking,
  StarSign,
} from '../common/enums';

export type BasicProfileData = {
  whereFrom?: string;
  placesLived?: string;
  gender?: string;
  height?: number;
  exercise?: Exercise;
  educationLevel?: EducationLevel;
  drinking?: Drinking;
  smoking?: Smoking;
  lookingFor?: LookingFor;
  kids?: Kids;
  politics?: Politics;
  religion?: Religion;
  starSign?: StarSign;
};

export type LocationType = {
  lat: number;
  lon: number;
};

export type PromptsType = {
  prompt: string;
  answer: string;
};

export type JobsType = {
  title: string;
  company: string;
};

export type EducationType = {
  institution: string;
  graduation: number;
};

export type UpdateUserType = {
  aboutMe?: string;
  dateOfBirth?: Date;
  photos?: string[];
  prompts?: PromptsType[];
  jobsAndEducation: {
    jobs?: JobsType[];
    education?: EducationType[];
  };
  basic: BasicProfileData;
  location?: LocationType;
};

export type Profile = {
  name: string;
  aboutMe?: string;
  dateOfBirth?: Date;
  photos?: string[];
  prompts?: PromptsType[];
  jobsAndEducation: {
    jobs?: JobsType[];
    education?: EducationType[];
  };
  basic: BasicProfileData;
  location?: LocationType;
};
