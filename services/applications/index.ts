import {
  BaseService,
  ServiceError,
  ValidationServiceError,
  NotFoundServiceError,
  wrapDALError,
} from "../base";
import {
  ApplicationDAL,
  CreateApplicationInput,
  UpdateApplicationInput,
  CreateHistoryInput,
} from "@/dal/applications";
import type { Application, ApplicationHistory } from "@/types";
import { PLAN_LIMITS } from "@/lib/constants/plans";
import { isOnFreePlan } from "@/lib/utils/plan-helpers";

export class ApplicationService
  implements
    BaseService<Application, CreateApplicationInput, UpdateApplicationInput>
{
  private applicationDAL = new ApplicationDAL();

  async create(data: CreateApplicationInput): Promise<Application> {
    try {
      // Validate required fields
      if (!data.company_name?.trim()) {
        throw new ValidationServiceError("Company name is required");
      }

      if (!data.position_title?.trim()) {
        throw new ValidationServiceError("Position title is required");
      }

      if (!data.application_date) {
        throw new ValidationServiceError("Application date is required");
      }

      // Validate application date is not in the future
      const applicationDate = new Date(data.application_date);
      if (applicationDate > new Date()) {
        throw new ValidationServiceError(
          "Application date cannot be in the future"
        );
      }

      const application = await this.applicationDAL.create(data);

      // Create initial history entry
      await this.applicationDAL.addHistory({
        application_id: application.id,
        user_id: data.user_id,
        status: data.status,
        notes: "Application created",
      });

      return application;
    } catch (error) {
      throw wrapDALError(error, "Failed to create application");
    }
  }

  async findById(id: string): Promise<Application | null> {
    try {
      return await this.applicationDAL.findById(id);
    } catch (error) {
      throw wrapDALError(error, "Failed to find application");
    }
  }

  async findByUserId(userId: string, status?: string): Promise<Application[]> {
    try {
      return await this.applicationDAL.findByUserId(userId, status);
    } catch (error) {
      throw wrapDALError(error, "Failed to find applications");
    }
  }

  async update(
    id: string,
    data: UpdateApplicationInput
  ): Promise<Application | null> {
    try {
      // Validate company name if provided
      if (data.company_name !== undefined && !data.company_name?.trim()) {
        throw new ValidationServiceError("Company name cannot be empty");
      }

      // Validate position title if provided
      if (data.position_title !== undefined && !data.position_title?.trim()) {
        throw new ValidationServiceError("Position title cannot be empty");
      }

      // Validate application date if provided
      if (data.application_date) {
        const applicationDate = new Date(data.application_date);
        if (applicationDate > new Date()) {
          throw new ValidationServiceError(
            "Application date cannot be in the future"
          );
        }
      }

      const application = await this.applicationDAL.update(id, data);
      if (!application) {
        throw new NotFoundServiceError("Application", id);
      }

      // Create history entry if status changed
      if (data.status && data.status !== application.status) {
        await this.applicationDAL.addHistory({
          application_id: id,
          user_id: application.user_id,
          status: data.status,
          notes: `Status changed to ${data.status}`,
        });
      }

      return application;
    } catch (error) {
      throw wrapDALError(error, "Failed to update application");
    }
  }

  async delete(id: string): Promise<boolean> {
    try {
      const success = await this.applicationDAL.delete(id);
      if (!success) {
        throw new NotFoundServiceError("Application", id);
      }
      return success;
    } catch (error) {
      throw wrapDALError(error, "Failed to delete application");
    }
  }

  async exists(id: string): Promise<boolean> {
    try {
      return await this.applicationDAL.exists(id);
    } catch (error) {
      throw wrapDALError(error, "Failed to check application existence");
    }
  }

  async count(userId?: string): Promise<number> {
    try {
      return await this.applicationDAL.count(userId);
    } catch (error) {
      throw wrapDALError(error, "Failed to count applications");
    }
  }

  // Application-specific methods
  async archive(id: string): Promise<Application | null> {
    try {
      const application = await this.applicationDAL.archive(id);
      if (!application) {
        throw new NotFoundServiceError("Application", id);
      }

      // Create history entry
      await this.applicationDAL.addHistory({
        application_id: id,
        user_id: application.user_id,
        status: "archived",
        notes: "Application archived",
      });

      return application;
    } catch (error) {
      throw wrapDALError(error, "Failed to archive application");
    }
  }

  async unarchive(id: string): Promise<Application | null> {
    try {
      const application = await this.applicationDAL.unarchive(id);
      if (!application) {
        throw new NotFoundServiceError("Application", id);
      }

      // Create history entry
      await this.applicationDAL.addHistory({
        application_id: id,
        user_id: application.user_id,
        status: "applied",
        notes: "Application unarchived",
      });

      return application;
    } catch (error) {
      throw wrapDALError(error, "Failed to unarchive application");
    }
  }

  async getArchived(userId: string): Promise<Application[]> {
    try {
      return await this.applicationDAL.getArchived(userId);
    } catch (error) {
      throw wrapDALError(error, "Failed to get archived applications");
    }
  }

  async getActive(userId: string): Promise<Application[]> {
    try {
      return await this.applicationDAL.getActive(userId);
    } catch (error) {
      throw wrapDALError(error, "Failed to get active applications");
    }
  }

  // History methods
  async getHistory(applicationId: string): Promise<ApplicationHistory[]> {
    try {
      return await this.applicationDAL.getHistory(applicationId);
    } catch (error) {
      throw wrapDALError(error, "Failed to get application history");
    }
  }

  async addHistory(data: CreateHistoryInput): Promise<ApplicationHistory> {
    try {
      return await this.applicationDAL.addHistory(data);
    } catch (error) {
      throw wrapDALError(error, "Failed to add history");
    }
  }

  // Analytics methods
  async getStatusCounts(userId: string): Promise<Record<string, number>> {
    try {
      return await this.applicationDAL.getStatusCounts(userId);
    } catch (error) {
      throw wrapDALError(error, "Failed to get status counts");
    }
  }

  async getRecentApplications(
    userId: string,
    limit: number = 5
  ): Promise<Application[]> {
    try {
      return await this.applicationDAL.getRecentApplications(userId, limit);
    } catch (error) {
      throw wrapDALError(error, "Failed to get recent applications");
    }
  }

  // Business logic methods
  async canCreateApplication(
    userId: string,
    userPlan: string
  ): Promise<boolean> {
    try {
      const activeCount = await this.applicationDAL.count(userId);

      // Free users have a limit, Pro and AI Coach users have unlimited
      if (isOnFreePlan(userPlan)) {
        return activeCount < PLAN_LIMITS.FREE_MAX_APPLICATIONS;
      }

      return true; // Pro and AI Coach users can create unlimited applications
    } catch (error) {
      throw wrapDALError(
        error,
        "Failed to check application creation permission"
      );
    }
  }

  async getApplicationWithHistory(applicationId: string): Promise<{
    application: Application;
    history: ApplicationHistory[];
  } | null> {
    try {
      const application = await this.findById(applicationId);
      if (!application) {
        return null;
      }

      const history = await this.getHistory(applicationId);
      return { application, history };
    } catch (error) {
      throw wrapDALError(error, "Failed to get application with history");
    }
  }

  async updateApplicationStatus(
    applicationId: string,
    newStatus: string,
    notes?: string
  ): Promise<Application | null> {
    try {
      const application = await this.update(applicationId, {
        status: newStatus as any,
      });

      if (application && notes) {
        await this.addHistory({
          application_id: applicationId,
          user_id: application.user_id,
          status: newStatus,
          notes,
        });
      }

      return application;
    } catch (error) {
      throw wrapDALError(error, "Failed to update application status");
    }
  }
}
