import ActivityLog from "../../activity-logs/Activitylog.ts";
import type { Request } from "express";

type ActivityAction = "CREATED" | "UPDATED" | "DELETED" | "LOGIN" | "LOGOUT";
type ActivityModule = "CASESTUDY" | "BLOGS" | "ACCOUNT_SETTINGS" | "AUTH";

interface LogActivityParams {
  action: ActivityAction;
  module: ActivityModule;
  admin: string; // Admin email
  details?: any; // The object that was created, updated, or deleted
  req?: Request;
}

/**
 * Get user email from request (from JWT payload)
 * This function checks multiple possible locations for the email
 */
export const getUserEmailFromRequest = (req: Request): string => {
  const user = (req as any).user;
  
  console.log("🔍 DEBUG: Extracting email from request...");
  console.log("🔍 DEBUG: User object:", JSON.stringify(user, null, 2));
  
  if (!user) {
    console.warn("⚠️ WARNING: No user object found in request. Using fallback email.");
    return "unknown@admin.com";
  }
  
  // Try to get email from various possible locations
  const email = 
    user.email || 
    user.Email || 
    user.EMAIL || 
    (user.payload && user.payload.email) ||
    null;
  
  if (!email) {
    console.warn("⚠️ WARNING: User object exists but no email found. User object keys:", Object.keys(user));
    console.warn("⚠️ WARNING: Full user object:", user);
    return "unknown@admin.com";
  }
  
  console.log("✅ Successfully extracted email:", email);
  return email;
};

/**
 * Log an activity to the database
 */
export const logActivity = async (params: LogActivityParams) => {
  try {
    const { action, module, admin, details = {} } = params;
    
    const now = new Date();
    
    console.log(`📝 Logging activity: ${action} - ${module} by ${admin}`);
    
    // Prepare the log entry with appropriate timestamp
    const logEntry: any = {
      action,
      module,
      admin,
      details,
      createdAt: null,
      updatedAt: null,
      deletedAt: null,
      loggedInAt: null,
      loggedOutAt: null,
    };

    // Set the appropriate timestamp based on action
    switch (action) {
      case "CREATED":
        logEntry.createdAt = now;
        break;
      case "UPDATED":
        logEntry.updatedAt = now;
        break;
      case "DELETED":
        logEntry.deletedAt = now;
        break;
      case "LOGIN":
        logEntry.loggedInAt = now;
        break;
      case "LOGOUT":
        logEntry.loggedOutAt = now;
        break;
    }

    // Create the activity log
    const activityLog = await ActivityLog.create(logEntry);
    
    console.log(`✅ Activity logged successfully: ${action} - ${module} by ${admin}`);
    console.log(`✅ Log ID: ${activityLog._id}`);
    
    return activityLog;
  } catch (error) {
    console.error("❌ Error logging activity:", error);
    if (error instanceof Error) {
      console.error("❌ Error message:", error.message);
      console.error("❌ Error stack:", error.stack);
    }
    // Don't throw error - we don't want logging failures to break the main operation
    return null;
  }
};