import { ResumeDAL } from "@/dal/resumes";
import { UserResume, CreateResumeInput, UpdateResumeInput } from "@/types";
import {
  BaseService,
  NotFoundServiceError,
  wrapDALError,
} from "@/services/base";

export class ResumeService
  implements BaseService<UserResume, CreateResumeInput, UpdateResumeInput>
{
  private resumeDAL = new ResumeDAL();

  async create(data: CreateResumeInput): Promise<UserResume> {
    try {
      return await this.resumeDAL.create(data);
    } catch (error) {
      throw wrapDALError(error, "Failed to create resume");
    }
  }

  async findById(id: string): Promise<UserResume | null> {
    try {
      return await this.resumeDAL.findById(id);
    } catch (error) {
      throw wrapDALError(error, "Failed to find resume");
    }
  }

  async findByUserId(userId: string): Promise<UserResume[]> {
    try {
      return await this.resumeDAL.findByUserId(userId);
    } catch (error) {
      throw wrapDALError(error, "Failed to find resumes");
    }
  }

  async findCurrentByUserId(userId: string): Promise<UserResume | null> {
    try {
      return await this.resumeDAL.findCurrentByUserId(userId);
    } catch (error) {
      throw wrapDALError(error, "Failed to find current resume");
    }
  }

  async update(
    id: string,
    data: UpdateResumeInput
  ): Promise<UserResume | null> {
    try {
      const resume = await this.resumeDAL.update(id, data);
      if (!resume) {
        throw new NotFoundServiceError("Resume", id);
      }
      return resume;
    } catch (error) {
      throw wrapDALError(error, "Failed to update resume");
    }
  }

  async upsertByUserId(
    userId: string,
    data: CreateResumeInput
  ): Promise<UserResume> {
    try {
      return await this.resumeDAL.upsertByUserId(userId, data);
    } catch (error) {
      throw wrapDALError(error, "Failed to upsert resume");
    }
  }

  async delete(id: string): Promise<boolean> {
    try {
      const success = await this.resumeDAL.delete(id);
      if (!success) {
        throw new NotFoundServiceError("Resume", id);
      }
      return success;
    } catch (error) {
      throw wrapDALError(error, "Failed to delete resume");
    }
  }

  async deleteByUserId(userId: string): Promise<boolean> {
    try {
      return await this.resumeDAL.deleteByUserId(userId);
    } catch (error) {
      throw wrapDALError(error, "Failed to delete resume");
    }
  }

  async exists(id: string): Promise<boolean> {
    try {
      return await this.resumeDAL.exists(id);
    } catch (error) {
      throw wrapDALError(error, "Failed to check resume existence");
    }
  }

  async count(userId?: string): Promise<number> {
    try {
      return await this.resumeDAL.count(userId);
    } catch (error) {
      throw wrapDALError(error, "Failed to count resumes");
    }
  }

  // Business logic methods
  async hasResume(userId: string): Promise<boolean> {
    try {
      const resume = await this.findCurrentByUserId(userId);
      return !!resume;
    } catch (error) {
      throw wrapDALError(error, "Failed to check if user has resume");
    }
  }

  async getResumeText(userId: string): Promise<string | null> {
    try {
      const resume = await this.findCurrentByUserId(userId);
      return resume?.extracted_text || null;
    } catch (error) {
      throw wrapDALError(error, "Failed to get resume text");
    }
  }
}
