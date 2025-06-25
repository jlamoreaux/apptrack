import {
  BaseService,
  ServiceError,
  ValidationServiceError,
  NotFoundServiceError,
  wrapDALError,
} from "../base";
import {
  UserDAL,
  CreateUserInput,
  UpdateUserInput,
  CreateProfileInput,
  UpdateProfileInput,
} from "@/dal/users";
import type { User, Profile } from "@/types";

export class UserService
  implements BaseService<User, CreateUserInput, UpdateUserInput>
{
  private userDAL = new UserDAL();

  async create(data: CreateUserInput): Promise<User> {
    try {
      // Validate email format
      if (!this.isValidEmail(data.email)) {
        throw new ValidationServiceError("Invalid email format");
      }

      // Validate password strength
      if (!this.isValidPassword(data.password)) {
        throw new ValidationServiceError(
          "Password must be at least 8 characters long"
        );
      }

      const user = await this.userDAL.create(data);

      // Create a default profile for the user
      await this.userDAL.createProfile({
        user_id: user.id,
        full_name: "",
        avatar_url: "",
      });

      return user;
    } catch (error) {
      throw wrapDALError(error, "Failed to create user");
    }
  }

  async findById(id: string): Promise<User | null> {
    try {
      return await this.userDAL.findById(id);
    } catch (error) {
      throw wrapDALError(error, "Failed to find user");
    }
  }

  async findByUserId(userId: string): Promise<User[]> {
    try {
      return await this.userDAL.findByUserId(userId);
    } catch (error) {
      throw wrapDALError(error, "Failed to find users");
    }
  }

  async update(id: string, data: UpdateUserInput): Promise<User | null> {
    try {
      // Validate email format if provided
      if (data.email && !this.isValidEmail(data.email)) {
        throw new ValidationServiceError("Invalid email format");
      }

      const user = await this.userDAL.update(id, data);
      if (!user) {
        throw new NotFoundServiceError("User", id);
      }

      return user;
    } catch (error) {
      throw wrapDALError(error, "Failed to update user");
    }
  }

  async delete(id: string): Promise<boolean> {
    try {
      const success = await this.userDAL.delete(id);
      if (!success) {
        throw new NotFoundServiceError("User", id);
      }
      return success;
    } catch (error) {
      throw wrapDALError(error, "Failed to delete user");
    }
  }

  async exists(id: string): Promise<boolean> {
    try {
      return await this.userDAL.exists(id);
    } catch (error) {
      throw wrapDALError(error, "Failed to check user existence");
    }
  }

  async count(userId?: string): Promise<number> {
    try {
      return await this.userDAL.count(userId);
    } catch (error) {
      throw wrapDALError(error, "Failed to count users");
    }
  }

  // Profile-specific methods
  async getProfile(userId: string): Promise<Profile | null> {
    try {
      return await this.userDAL.getProfile(userId);
    } catch (error) {
      throw wrapDALError(error, "Failed to get profile");
    }
  }

  async updateProfile(
    userId: string,
    data: UpdateProfileInput
  ): Promise<Profile | null> {
    try {
      const profile = await this.userDAL.updateProfile(userId, data);
      if (!profile) {
        throw new NotFoundServiceError("Profile", userId);
      }
      return profile;
    } catch (error) {
      throw wrapDALError(error, "Failed to update profile");
    }
  }

  async createProfile(data: CreateProfileInput): Promise<Profile> {
    try {
      return await this.userDAL.createProfile(data);
    } catch (error) {
      throw wrapDALError(error, "Failed to create profile");
    }
  }

  // Business logic validation methods
  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  private isValidPassword(password: string): boolean {
    return password.length >= 8;
  }

  // Additional business logic methods
  async getUserWithProfile(
    userId: string
  ): Promise<{ user: User; profile: Profile | null } | null> {
    try {
      const user = await this.findById(userId);
      if (!user) {
        return null;
      }

      const profile = await this.getProfile(userId);
      return { user, profile };
    } catch (error) {
      throw wrapDALError(error, "Failed to get user with profile");
    }
  }

  async updateUserAndProfile(
    userId: string,
    userData: UpdateUserInput,
    profileData: UpdateProfileInput
  ): Promise<{ user: User; profile: Profile | null }> {
    try {
      const [user, profile] = await Promise.all([
        this.update(userId, userData),
        this.updateProfile(userId, profileData),
      ]);

      if (!user) {
        throw new NotFoundServiceError("User", userId);
      }

      return { user, profile };
    } catch (error) {
      throw wrapDALError(error, "Failed to update user and profile");
    }
  }
}
