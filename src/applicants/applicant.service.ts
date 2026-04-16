import Applicant, { type IApplicant } from './applicant.model.ts';
import crypto from 'crypto';

function generateConfirmCode(): string {
  const rand = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `VA-${rand}-${new Date().getFullYear()}`;
}

export const createApplicant = async (
  data: Omit<IApplicant, '_id' | 'status' | 'confirmCode' | 'appliedAt' | 'createdAt' | 'updatedAt'>,
): Promise<IApplicant> => {
  const confirmCode = generateConfirmCode();
  const applicant = new Applicant({ ...data, confirmCode });
  return applicant.save() as unknown as IApplicant;
};

export const getAllApplicants = async (): Promise<IApplicant[]> => {
  return Applicant.find().sort({ appliedAt: -1 }).lean() as unknown as IApplicant[];
};

export const getApplicantById = async (id: string): Promise<IApplicant | null> => {
  return Applicant.findById(id).lean() as unknown as IApplicant | null;
};

export const updateApplicantStatus = async (
  id: string,
  status: 'approved' | 'rejected',
): Promise<IApplicant | null> => {
  return Applicant.findByIdAndUpdate(id, { status }, { new: true }).lean() as unknown as IApplicant | null;
};