import { Schema, model } from "mongoose";

export interface ProjectDocument {
  title: string;
  category?: string;
  description?: string;
  projectDate: Date;
  imageUrl: string;
  storagePath: string;
  liveUrl?: string;
  githubUrl?: string;
  createdAt: Date;
  updatedAt: Date;
}

const projectSchema = new Schema<ProjectDocument>(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      minlength: 3,
      maxlength: 100,
    },
    category: {
      type: String,
      trim: true,
      default: "Fullstack App",
      enum: [
        "AI Integration",
        "Fullstack App",
        "Automation",
        "Scalable API",
        "Machine Learning",
        "DevOps Tool",
        "Mobile App",
        "Open Source",
      ],
    },
    description: {
      type: String,
      trim: true,
      default: "",
      maxlength: 2000,
    },
    projectDate: {
      type: Date,
      required: true,
      validate: {
        validator: (value: Date) => value <= new Date(),
        message: "Project date cannot be in the future",
      },
    },
    imageUrl: {
      type: String,
      required: true,
      trim: true,
      match: [/^https?:\/\/.+/, "Please provide a valid image URL"],
    },
    storagePath: {
      type: String,
      required: true,
      trim: true,
    },
    liveUrl: {
      type: String,
      trim: true,
      match: [/^https?:\/\/.+/, "Please provide a valid live demo URL"],
      default: null,
    },
    githubUrl: {
      type: String,
      trim: true,
      match: [
        /^https?:\/\/(www\.)?github\.com\/.+\/.+$/,
        "Please provide a valid GitHub repository URL",
      ],
      default: null,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

// Indexes for better query performance
projectSchema.index({ category: 1 });
projectSchema.index({ projectDate: -1 });
projectSchema.index({ createdAt: -1 });

// Virtual for formatted project date
projectSchema.virtual("formattedDate").get(function () {
  if (!this.projectDate) return null;
  return this.projectDate.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
});

// Virtual for relative time (e.g., "2 months ago")
projectSchema.virtual("relativeDate").get(function () {
  const diffDays = Math.floor(
    (Date.now() - this.projectDate.getTime()) / (1000 * 60 * 60 * 24),
  );
  if (diffDays < 30) return `${diffDays} day${diffDays !== 1 ? "s" : ""} ago`;
  if (diffDays < 365)
    return `${Math.floor(diffDays / 30)} month${Math.floor(diffDays / 30) !== 1 ? "s" : ""} ago`;
  return `${Math.floor(diffDays / 365)} year${Math.floor(diffDays / 365) !== 1 ? "s" : ""} ago`;
});

// Static method to get projects by category with pagination
projectSchema.statics.findByCategory = function (
  category: string,
  limit = 10,
  skip = 0,
) {
  return this.find({ category })
    .sort({ projectDate: -1 })
    .limit(limit)
    .skip(skip);
};

// Static method to get recent projects
projectSchema.statics.findRecent = function (limit = 6) {
  return this.find().sort({ projectDate: -1, createdAt: -1 }).limit(limit);
};

// Static method to get project count by category
projectSchema.statics.getCategoryCounts = function () {
  return this.aggregate([
    { $group: { _id: "$category", count: { $sum: 1 } } },
    { $sort: { count: -1 } },
  ]);
};

// Method to check if project has both live and GitHub links
projectSchema.methods.hasCompleteLinks = function () {
  return !!(this.liveUrl && this.githubUrl);
};

// Method to get project summary
projectSchema.methods.getSummary = function () {
  return {
    id: this._id,
    title: this.title,
    category: this.category,
    description: this.description?.substring(0, 150),
    imageUrl: this.imageUrl,
    projectDate: this.projectDate,
    liveUrl: this.liveUrl,
    githubUrl: this.githubUrl,
  };
};

// Pre-save middleware to validate at least one URL if it's a public project
projectSchema.pre("save", function (next) {
  // Optional: Add validation if needed
  // Example: Require at least one URL for featured projects
  next();
});

// Pre-save middleware to trim whitespace from URLs
projectSchema.pre("save", function (next) {
  if (this.liveUrl) this.liveUrl = this.liveUrl.trim();
  if (this.githubUrl) this.githubUrl = this.githubUrl.trim();
  next();
});

export const Project = model<ProjectDocument>("Project", projectSchema);
