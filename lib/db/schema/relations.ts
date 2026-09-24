import { relations } from "drizzle-orm/relations";
// auth.users - drizzle-kit pull referenced this as `usersInAuth` without defining it.
import { users as usersInAuth } from "./auth";
import { profiles, applications, linkedinProfiles, coverLetters, userResumes, jobFitAnalysis, applicationLinkedinContacts, linkedinProfilesNew, promoCodeUsage, resumeAnalysis, aiGuestSessions, aiTrialResults, interviewPrep, aiPreviewSessions, conversations, careerAdvice, subscriptionPlans, userSubscriptions, usageTracking, adminUsers, trialHistory, scheduledNotifications, aiUsageTracking, aiFeatureUsage, emailPreferences, audienceMembers, roasts, aiUserLimitOverrides, applicationHistory, userAnnouncements, userOnboardingPreferences, userOnboarding, dripEmails, aiGuestConversions, wins, careerGoals, compEntries, careerWaitlist, careerProfiles, weeklyRecaps, coachMemory, tailoredResumes } from "./schema";

export const applicationsRelations = relations(applications, ({one, many}) => ({
	profile: one(profiles, {
		fields: [applications.userId],
		references: [profiles.id]
	}),
	linkedinProfiles: many(linkedinProfiles),
	coverLetters: many(coverLetters),
	jobFitAnalyses: many(jobFitAnalysis),
	applicationLinkedinContacts: many(applicationLinkedinContacts),
	applicationHistories: many(applicationHistory),
	tailoredResumes: many(tailoredResumes),
}));

export const profilesRelations = relations(profiles, ({one, many}) => ({
	applications: many(applications),
	promoCodeUsages: many(promoCodeUsage),
	userSubscriptions: many(userSubscriptions),
	usageTrackings: many(usageTracking),
	trialHistories: many(trialHistory),
	scheduledNotifications: many(scheduledNotifications),
	emailPreferences: many(emailPreferences),
	audienceMembers: many(audienceMembers),
	dripEmails: many(dripEmails),
	userResumes: many(userResumes),
	wins: many(wins),
	usersInAuth: one(usersInAuth, {
		fields: [profiles.id],
		references: [usersInAuth.id]
	}),
	compEntries: many(compEntries),
	careerWaitlists: many(careerWaitlist),
	careerProfiles: many(careerProfiles),
	weeklyRecaps: many(weeklyRecaps),
	tailoredResumes: many(tailoredResumes),
}));

export const linkedinProfilesRelations = relations(linkedinProfiles, ({one}) => ({
	application: one(applications, {
		fields: [linkedinProfiles.applicationId],
		references: [applications.id]
	}),
	usersInAuth: one(usersInAuth, {
		fields: [linkedinProfiles.userId],
		references: [usersInAuth.id]
	}),
}));

export const usersInAuthRelations = relations(usersInAuth, ({many}) => ({
	linkedinProfiles: many(linkedinProfiles),
	coverLetters: many(coverLetters),
	jobFitAnalyses: many(jobFitAnalysis),
	applicationLinkedinContacts: many(applicationLinkedinContacts),
	resumeAnalyses: many(resumeAnalysis),
	aiTrialResults: many(aiTrialResults),
	interviewPreps: many(interviewPrep),
	aiPreviewSessions: many(aiPreviewSessions),
	careerAdvices: many(careerAdvice),
	adminUsers: many(adminUsers),
	aiUsageTrackings: many(aiUsageTracking),
	aiFeatureUsages: many(aiFeatureUsage),
	roasts: many(roasts),
	aiUserLimitOverrides_createdBy: many(aiUserLimitOverrides, {
		relationName: "aiUserLimitOverrides_createdBy_usersInAuth_id"
	}),
	aiUserLimitOverrides_userId: many(aiUserLimitOverrides, {
		relationName: "aiUserLimitOverrides_userId_usersInAuth_id"
	}),
	userAnnouncements: many(userAnnouncements),
	userOnboardingPreferences: many(userOnboardingPreferences),
	userOnboardings: many(userOnboarding),
	aiGuestSessions: many(aiGuestSessions),
	aiGuestConversions: many(aiGuestConversions),
	conversations: many(conversations),
	profiles: many(profiles),
	careerGoals: many(careerGoals),
	coachMemories: many(coachMemory),
}));

export const coverLettersRelations = relations(coverLetters, ({one}) => ({
	application: one(applications, {
		fields: [coverLetters.applicationId],
		references: [applications.id]
	}),
	usersInAuth: one(usersInAuth, {
		fields: [coverLetters.userId],
		references: [usersInAuth.id]
	}),
	userResume: one(userResumes, {
		fields: [coverLetters.userResumeId],
		references: [userResumes.id]
	}),
}));

export const userResumesRelations = relations(userResumes, ({one, many}) => ({
	coverLetters: many(coverLetters),
	jobFitAnalyses: many(jobFitAnalysis),
	resumeAnalyses: many(resumeAnalysis),
	interviewPreps: many(interviewPrep),
	profile: one(profiles, {
		fields: [userResumes.userId],
		references: [profiles.id]
	}),
}));

export const jobFitAnalysisRelations = relations(jobFitAnalysis, ({one}) => ({
	application: one(applications, {
		fields: [jobFitAnalysis.applicationId],
		references: [applications.id]
	}),
	usersInAuth: one(usersInAuth, {
		fields: [jobFitAnalysis.userId],
		references: [usersInAuth.id]
	}),
	userResume: one(userResumes, {
		fields: [jobFitAnalysis.userResumeId],
		references: [userResumes.id]
	}),
}));

export const applicationLinkedinContactsRelations = relations(applicationLinkedinContacts, ({one}) => ({
	application: one(applications, {
		fields: [applicationLinkedinContacts.applicationId],
		references: [applications.id]
	}),
	linkedinProfilesNew: one(linkedinProfilesNew, {
		fields: [applicationLinkedinContacts.linkedinProfileId],
		references: [linkedinProfilesNew.id]
	}),
	usersInAuth: one(usersInAuth, {
		fields: [applicationLinkedinContacts.userId],
		references: [usersInAuth.id]
	}),
}));

export const linkedinProfilesNewRelations = relations(linkedinProfilesNew, ({many}) => ({
	applicationLinkedinContacts: many(applicationLinkedinContacts),
}));

export const promoCodeUsageRelations = relations(promoCodeUsage, ({one}) => ({
	profile: one(profiles, {
		fields: [promoCodeUsage.userId],
		references: [profiles.id]
	}),
}));

export const resumeAnalysisRelations = relations(resumeAnalysis, ({one}) => ({
	usersInAuth: one(usersInAuth, {
		fields: [resumeAnalysis.userId],
		references: [usersInAuth.id]
	}),
	userResume: one(userResumes, {
		fields: [resumeAnalysis.userResumeId],
		references: [userResumes.id]
	}),
}));

export const aiTrialResultsRelations = relations(aiTrialResults, ({one}) => ({
	aiGuestSession: one(aiGuestSessions, {
		fields: [aiTrialResults.sessionId],
		references: [aiGuestSessions.id]
	}),
	usersInAuth: one(usersInAuth, {
		fields: [aiTrialResults.userId],
		references: [usersInAuth.id]
	}),
}));

export const aiGuestSessionsRelations = relations(aiGuestSessions, ({one, many}) => ({
	aiTrialResults: many(aiTrialResults),
	usersInAuth: one(usersInAuth, {
		fields: [aiGuestSessions.convertedUserId],
		references: [usersInAuth.id]
	}),
	aiGuestConversions: many(aiGuestConversions),
}));

export const interviewPrepRelations = relations(interviewPrep, ({one}) => ({
	usersInAuth: one(usersInAuth, {
		fields: [interviewPrep.userId],
		references: [usersInAuth.id]
	}),
	userResume: one(userResumes, {
		fields: [interviewPrep.userResumeId],
		references: [userResumes.id]
	}),
}));

export const aiPreviewSessionsRelations = relations(aiPreviewSessions, ({one}) => ({
	usersInAuth: one(usersInAuth, {
		fields: [aiPreviewSessions.userId],
		references: [usersInAuth.id]
	}),
}));

export const careerAdviceRelations = relations(careerAdvice, ({one}) => ({
	conversation: one(conversations, {
		fields: [careerAdvice.conversationId],
		references: [conversations.id]
	}),
	usersInAuth: one(usersInAuth, {
		fields: [careerAdvice.userId],
		references: [usersInAuth.id]
	}),
}));

export const conversationsRelations = relations(conversations, ({one, many}) => ({
	careerAdvices: many(careerAdvice),
	usersInAuth: one(usersInAuth, {
		fields: [conversations.userId],
		references: [usersInAuth.id]
	}),
}));

export const userSubscriptionsRelations = relations(userSubscriptions, ({one}) => ({
	subscriptionPlan: one(subscriptionPlans, {
		fields: [userSubscriptions.planId],
		references: [subscriptionPlans.id]
	}),
	profile: one(profiles, {
		fields: [userSubscriptions.userId],
		references: [profiles.id]
	}),
}));

export const subscriptionPlansRelations = relations(subscriptionPlans, ({many}) => ({
	userSubscriptions: many(userSubscriptions),
	trialHistories: many(trialHistory),
}));

export const usageTrackingRelations = relations(usageTracking, ({one}) => ({
	profile: one(profiles, {
		fields: [usageTracking.userId],
		references: [profiles.id]
	}),
}));

export const adminUsersRelations = relations(adminUsers, ({one}) => ({
	usersInAuth: one(usersInAuth, {
		fields: [adminUsers.userId],
		references: [usersInAuth.id]
	}),
}));

export const trialHistoryRelations = relations(trialHistory, ({one}) => ({
	subscriptionPlan: one(subscriptionPlans, {
		fields: [trialHistory.planId],
		references: [subscriptionPlans.id]
	}),
	profile: one(profiles, {
		fields: [trialHistory.userId],
		references: [profiles.id]
	}),
}));

export const scheduledNotificationsRelations = relations(scheduledNotifications, ({one}) => ({
	profile: one(profiles, {
		fields: [scheduledNotifications.userId],
		references: [profiles.id]
	}),
}));

export const aiUsageTrackingRelations = relations(aiUsageTracking, ({one}) => ({
	usersInAuth: one(usersInAuth, {
		fields: [aiUsageTracking.userId],
		references: [usersInAuth.id]
	}),
}));

export const aiFeatureUsageRelations = relations(aiFeatureUsage, ({one}) => ({
	usersInAuth: one(usersInAuth, {
		fields: [aiFeatureUsage.userId],
		references: [usersInAuth.id]
	}),
}));

export const emailPreferencesRelations = relations(emailPreferences, ({one}) => ({
	profile: one(profiles, {
		fields: [emailPreferences.userId],
		references: [profiles.id]
	}),
}));

export const audienceMembersRelations = relations(audienceMembers, ({one}) => ({
	profile: one(profiles, {
		fields: [audienceMembers.userId],
		references: [profiles.id]
	}),
}));

export const roastsRelations = relations(roasts, ({one}) => ({
	usersInAuth: one(usersInAuth, {
		fields: [roasts.userId],
		references: [usersInAuth.id]
	}),
}));

export const aiUserLimitOverridesRelations = relations(aiUserLimitOverrides, ({one}) => ({
	usersInAuth_createdBy: one(usersInAuth, {
		fields: [aiUserLimitOverrides.createdBy],
		references: [usersInAuth.id],
		relationName: "aiUserLimitOverrides_createdBy_usersInAuth_id"
	}),
	usersInAuth_userId: one(usersInAuth, {
		fields: [aiUserLimitOverrides.userId],
		references: [usersInAuth.id],
		relationName: "aiUserLimitOverrides_userId_usersInAuth_id"
	}),
}));

export const applicationHistoryRelations = relations(applicationHistory, ({one}) => ({
	application: one(applications, {
		fields: [applicationHistory.applicationId],
		references: [applications.id]
	}),
}));

export const userAnnouncementsRelations = relations(userAnnouncements, ({one}) => ({
	usersInAuth: one(usersInAuth, {
		fields: [userAnnouncements.userId],
		references: [usersInAuth.id]
	}),
}));

export const userOnboardingPreferencesRelations = relations(userOnboardingPreferences, ({one}) => ({
	usersInAuth: one(usersInAuth, {
		fields: [userOnboardingPreferences.userId],
		references: [usersInAuth.id]
	}),
}));

export const userOnboardingRelations = relations(userOnboarding, ({one}) => ({
	usersInAuth: one(usersInAuth, {
		fields: [userOnboarding.userId],
		references: [usersInAuth.id]
	}),
}));

export const dripEmailsRelations = relations(dripEmails, ({one}) => ({
	profile: one(profiles, {
		fields: [dripEmails.userId],
		references: [profiles.id]
	}),
}));

export const aiGuestConversionsRelations = relations(aiGuestConversions, ({one}) => ({
	aiGuestSession: one(aiGuestSessions, {
		fields: [aiGuestConversions.guestSessionId],
		references: [aiGuestSessions.id]
	}),
	usersInAuth: one(usersInAuth, {
		fields: [aiGuestConversions.userId],
		references: [usersInAuth.id]
	}),
}));

export const winsRelations = relations(wins, ({one}) => ({
	profile: one(profiles, {
		fields: [wins.userId],
		references: [profiles.id]
	}),
}));

export const careerGoalsRelations = relations(careerGoals, ({one}) => ({
	usersInAuth: one(usersInAuth, {
		fields: [careerGoals.userId],
		references: [usersInAuth.id]
	}),
}));

export const compEntriesRelations = relations(compEntries, ({one}) => ({
	profile: one(profiles, {
		fields: [compEntries.userId],
		references: [profiles.id]
	}),
}));

export const careerWaitlistRelations = relations(careerWaitlist, ({one}) => ({
	profile: one(profiles, {
		fields: [careerWaitlist.userId],
		references: [profiles.id]
	}),
}));

export const careerProfilesRelations = relations(careerProfiles, ({one}) => ({
	profile: one(profiles, {
		fields: [careerProfiles.userId],
		references: [profiles.id]
	}),
}));

export const weeklyRecapsRelations = relations(weeklyRecaps, ({one}) => ({
	profile: one(profiles, {
		fields: [weeklyRecaps.userId],
		references: [profiles.id]
	}),
}));

export const coachMemoryRelations = relations(coachMemory, ({one}) => ({
	usersInAuth: one(usersInAuth, {
		fields: [coachMemory.userId],
		references: [usersInAuth.id]
	}),
}));

export const tailoredResumesRelations = relations(tailoredResumes, ({one}) => ({
	application: one(applications, {
		fields: [tailoredResumes.applicationId],
		references: [applications.id]
	}),
	profile: one(profiles, {
		fields: [tailoredResumes.userId],
		references: [profiles.id]
	}),
}));