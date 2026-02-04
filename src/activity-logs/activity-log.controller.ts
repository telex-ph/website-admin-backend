import type { Request, Response } from "express";
import ActivityLog from "./Activitylog.ts";

// Get all activity logs with filtering
export const getAllActivityLogs = async (req: Request, res: Response) => {
  try {
    const { action, module, admin, startDate, endDate, sortBy, order, limit, page } = req.query;
    
    const filter: any = {};

    // Filter by action
    if (action) {
      filter.action = action;
    }

    // Filter by module
    if (module) {
      filter.module = module;
    }

    // Filter by admin email
    if (admin) {
      filter.admin = { $regex: admin, $options: "i" };
    }

    // Filter by date range
    if (startDate || endDate) {
      filter.$or = [];
      const dateFilter: any = {};
      
      if (startDate) {
        dateFilter.$gte = new Date(startDate as string);
      }
      if (endDate) {
        dateFilter.$lte = new Date(endDate as string);
      }
      
      // Check all timestamp fields
      filter.$or.push(
        { createdAt: dateFilter },
        { updatedAt: dateFilter },
        { deletedAt: dateFilter },
        { loggedInAt: dateFilter },
        { loggedOutAt: dateFilter }
      );
    }

    // Build sort object
    const sort: any = {};
    if (sortBy) {
      sort[sortBy as string] = order === "desc" ? -1 : 1;
    } else {
      // Default sort by most recent timestamp
      sort._id = -1;
    }

    // Pagination
    const pageNum = parseInt(page as string) || 1;
    const limitNum = parseInt(limit as string) || 50;
    const skip = (pageNum - 1) * limitNum;

    const [logs, total] = await Promise.all([
      ActivityLog.find(filter)
        .sort(sort)
        .skip(skip)
        .limit(limitNum)
        .exec(),
      ActivityLog.countDocuments(filter)
    ]);

    res.status(200).json({
      logs,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error: unknown) {
    if (error instanceof Error) {
      console.error("Fetching activity logs error:", error.message);
      res.status(400).json({ error: error.message });
    } else {
      console.error("Activity logs error:", error);
      res.status(400).json({ error: "Unknown error occurred" });
    }
  }
};

// Get single activity log by ID
export const getActivityLog = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        error: "Validation failed",
        message: "ID parameter is required",
      });
    }

    const log = await ActivityLog.findById(id).exec();

    if (!log) {
      return res.status(404).json({ error: "Activity log not found" });
    }

    res.status(200).json(log);
  } catch (error: unknown) {
    if (error instanceof Error) {
      console.error("Fetching activity log error:", error.message);
      res.status(400).json({ error: error.message });
    } else {
      console.error("Activity log error:", error);
      res.status(400).json({ error: "Unknown error occurred" });
    }
  }
};

// Get activity logs by admin email
export const getActivityLogsByAdmin = async (req: Request, res: Response) => {
  try {
    const { email } = req.params;

    if (!email) {
      return res.status(400).json({
        error: "Validation failed",
        message: "Email parameter is required",
      });
    }

    const logs = await ActivityLog.find({ admin: email })
      .sort({ _id: -1 })
      .exec();

    res.status(200).json(logs);
  } catch (error: unknown) {
    if (error instanceof Error) {
      console.error("Fetching activity logs by admin error:", error.message);
      res.status(400).json({ error: error.message });
    } else {
      console.error("Activity log error:", error);
      res.status(400).json({ error: "Unknown error occurred" });
    }
  }
};

// Get activity statistics
export const getActivityStats = async (req: Request, res: Response) => {
  try {
    const { startDate, endDate } = req.query;
    
    const matchStage: any = {};
    
    if (startDate || endDate) {
      matchStage.$or = [];
      const dateFilter: any = {};
      
      if (startDate) {
        dateFilter.$gte = new Date(startDate as string);
      }
      if (endDate) {
        dateFilter.$lte = new Date(endDate as string);
      }
      
      matchStage.$or.push(
        { createdAt: dateFilter },
        { updatedAt: dateFilter },
        { deletedAt: dateFilter },
        { loggedInAt: dateFilter },
        { loggedOutAt: dateFilter }
      );
    }

    const pipeline: any[] = [];
    
    if (Object.keys(matchStage).length > 0) {
      pipeline.push({ $match: matchStage });
    }

    pipeline.push(
      {
        $group: {
          _id: null,
          totalLogs: { $sum: 1 },
          byAction: {
            $push: "$action"
          },
          byModule: {
            $push: "$module"
          },
          uniqueAdmins: {
            $addToSet: "$admin"
          }
        }
      },
      {
        $project: {
          _id: 0,
          totalLogs: 1,
          uniqueAdmins: { $size: "$uniqueAdmins" },
          actionCounts: {
            created: {
              $size: {
                $filter: {
                  input: "$byAction",
                  as: "action",
                  cond: { $eq: ["$$action", "CREATED"] }
                }
              }
            },
            updated: {
              $size: {
                $filter: {
                  input: "$byAction",
                  as: "action",
                  cond: { $eq: ["$$action", "UPDATED"] }
                }
              }
            },
            deleted: {
              $size: {
                $filter: {
                  input: "$byAction",
                  as: "action",
                  cond: { $eq: ["$$action", "DELETED"] }
                }
              }
            },
            login: {
              $size: {
                $filter: {
                  input: "$byAction",
                  as: "action",
                  cond: { $eq: ["$$action", "LOGIN"] }
                }
              }
            },
            logout: {
              $size: {
                $filter: {
                  input: "$byAction",
                  as: "action",
                  cond: { $eq: ["$$action", "LOGOUT"] }
                }
              }
            }
          },
          moduleCounts: {
            casestudy: {
              $size: {
                $filter: {
                  input: "$byModule",
                  as: "module",
                  cond: { $eq: ["$$module", "CASESTUDY"] }
                }
              }
            },
            blogs: {
              $size: {
                $filter: {
                  input: "$byModule",
                  as: "module",
                  cond: { $eq: ["$$module", "BLOGS"] }
                }
              }
            },
            accountSettings: {
              $size: {
                $filter: {
                  input: "$byModule",
                  as: "module",
                  cond: { $eq: ["$$module", "ACCOUNT_SETTINGS"] }
                }
              }
            },
            auth: {
              $size: {
                $filter: {
                  input: "$byModule",
                  as: "module",
                  cond: { $eq: ["$$module", "AUTH"] }
                }
              }
            }
          }
        }
      }
    );

    const stats = await ActivityLog.aggregate(pipeline);

    res.status(200).json(stats[0] || {
      totalLogs: 0,
      uniqueAdmins: 0,
      actionCounts: {
        created: 0,
        updated: 0,
        deleted: 0,
        login: 0,
        logout: 0
      },
      moduleCounts: {
        casestudy: 0,
        blogs: 0,
        accountSettings: 0,
        auth: 0
      }
    });
  } catch (error: unknown) {
    if (error instanceof Error) {
      console.error("Fetching activity stats error:", error.message);
      res.status(400).json({ error: error.message });
    } else {
      console.error("Activity stats error:", error);
      res.status(400).json({ error: "Unknown error occurred" });
    }
  }
};

// Delete old activity logs (for maintenance)
export const deleteOldLogs = async (req: Request, res: Response) => {
  try {
    const { days } = req.query;
    
    if (!days) {
      return res.status(400).json({
        error: "Validation failed",
        message: "days query parameter is required (e.g., ?days=90)",
      });
    }

    const daysAgo = new Date();
    daysAgo.setDate(daysAgo.getDate() - parseInt(days as string));

    const result = await ActivityLog.deleteMany({
      $or: [
        { createdAt: { $lt: daysAgo, $ne: null } },
        { updatedAt: { $lt: daysAgo, $ne: null } },
        { deletedAt: { $lt: daysAgo, $ne: null } },
        { loggedInAt: { $lt: daysAgo, $ne: null } },
        { loggedOutAt: { $lt: daysAgo, $ne: null } },
      ]
    });

    res.status(200).json({
      message: `Deleted activity logs older than ${days} days`,
      deletedCount: result.deletedCount,
    });
  } catch (error: unknown) {
    if (error instanceof Error) {
      console.error("Deleting old logs error:", error.message);
      res.status(400).json({ error: error.message });
    } else {
      console.error("Delete logs error:", error);
      res.status(400).json({ error: "Unknown error occurred" });
    }
  }
};