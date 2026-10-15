import { Router } from "express";
import { timingSafeEqual } from "node:crypto";
import swaggerUi from "swagger-ui-express";

const router = Router();

const unauthorized = (res) => {
	res.set("WWW-Authenticate", 'Basic realm="Library Management System API Docs"');
	return res.status(401).send("Authentication required");
};

const matchesCredential = (provided, expected) => {
	const providedBuffer = Buffer.from(provided);
	const expectedBuffer = Buffer.from(expected);
	return providedBuffer.length === expectedBuffer.length && timingSafeEqual(providedBuffer, expectedBuffer);
};

const authorizeDocs = (req, res, next) => {
	const username = process.env.SWAGGER_USERNAME;
	const password = process.env.SWAGGER_PASSWORD;

	if (!username || !password) {
		if (process.env.NODE_ENV === "production") return res.sendStatus(404);
		if (username || password) return res.status(503).send("Configure both Swagger credentials");
		return next();
	}

	const [scheme, encoded] = (req.get("authorization") || "").split(" ");
	if (scheme !== "Basic" || !encoded || !/^[A-Za-z0-9+/]+={0,2}$/.test(encoded)) {
		return unauthorized(res);
	}

	const credentials = Buffer.from(encoded, "base64").toString("utf8");
	const separator = credentials.indexOf(":");
	if (separator < 0) return unauthorized(res);

	const suppliedUsername = credentials.slice(0, separator);
	const suppliedPassword = credentials.slice(separator + 1);
	if (!matchesCredential(suppliedUsername, username) || !matchesCredential(suppliedPassword, password)) {
		return unauthorized(res);
	}

	return next();
};

const swaggerDocument = {
	openapi: "3.0.3",
	info: {
		title: "Library Management System API",
		version: "1.0.0",
		description:
			"API reference for Library Management System API, covering account access, profile management, and payment operations. Sign in to receive a bearer token, then use it for protected endpoints.",
	},
	tags: [
		{ name: "Health", description: "Service availability" },
		{ name: "Authentication", description: "Create an account and sign in" },
		{ name: "Profile", description: "Read and update the signed-in user's profile" },
		{ name: "Notifications", description: "Read and stream in-app notifications" },
		{ name: "Favourites", description: "Save and manage favourite workspaces" },
		{ name: "Reviews", description: "Submit and browse workspace reviews" },
		{ name: "Workspaces", description: "Create, browse, and manage workspace listings" },
		{ name: "Bookings", description: "Reserve approved workspaces and manage booking status" },
		{ name: "Availability", description: "Manage and check workspace opening hours" },
		{ name: "Blocked Periods", description: "Block workspace date/time intervals" },
		{ name: "Workspace Moderation", description: "Approve, reject, or suspend host workspace listings" },
		{ name: "Admin", description: "Manage platform settings, administrator invitations, and user accounts" },
		{ name: "Payments", description: "Initialize and verify payments, and receive Paystack webhooks" },
		{ name: "Admin Transactions", description: "Review host transactions and administer payment refunds" },
		{ name: "Host Withdrawals", description: "Initiate and track host withdrawals through Paystack Transfers" },
	],
	paths: {
		"/health": {
			get: {
				tags: ["Health"],
				summary: "Check service health",
				description: "Use this endpoint to confirm the API process is responding.",
				operationId: "getHealth",
				responses: {
					200: {
						description: "The API is responding.",
						content: {
							"application/json": {
								example: { success: true, data: { status: "ok" } },
							},
						},
					},
				},
			},
		},
		"/api/workspaces": {
			get: {
				tags: ["Workspaces"],
				summary: "List approved workspaces",
				description: "Returns available approved workspaces with rating and pagination data. Public responses hide exact addresses and round map coordinates. Supports location, activities, text, price, capacity, neighborhood, and requested-time availability filters.",
				operationId: "listWorkspaces",
				parameters: [
					{ name: "city", in: "query", schema: { type: "string" } },
					{ name: "state", in: "query", schema: { type: "string" } },
					{ name: "country", in: "query", schema: { type: "string" } },
					{ name: "type", in: "query", schema: { type: "string" } },
					{ name: "category", in: "query", schema: { type: "string" }, description: "Compatibility alias for type." },
					{ name: "capacity", in: "query", schema: { type: "integer", minimum: 1 } },
					{ name: "minCapacity", in: "query", schema: { type: "integer", minimum: 1 } },
					{ name: "priceUnit", in: "query", schema: { type: "string", enum: ["hour", "day"], default: "hour" }, description: "Unit used when filtering price ranges." },
					{ name: "minPrice", in: "query", schema: { type: "number", minimum: 0 }, description: "Minimum rate in the selected priceUnit." },
					{ name: "maxPrice", in: "query", schema: { type: "number", minimum: 0 }, description: "Maximum rate in the selected priceUnit." },
					{ name: "q", in: "query", schema: { type: "string" }, description: "Text search across title, description, location names, neighborhood, and street address." },
					{ name: "activity", in: "query", schema: { type: "string" } },
					{ name: "neighborhood", in: "query", schema: { type: "string" } },
					{ name: "startDateTime", in: "query", schema: { type: "string", format: "date-time" }, description: "Pair with endDateTime to return only workspaces available for this interval." },
					{ name: "endDateTime", in: "query", schema: { type: "string", format: "date-time" } },
					{ name: "page", in: "query", schema: { type: "integer", minimum: 1, default: 1 } },
					{ name: "limit", in: "query", schema: { type: "integer", minimum: 1, maximum: 100, default: 20 } },
				],
				responses: {
					200: { description: "Approved workspace listings.", content: { "application/json": { schema: { $ref: "#/components/schemas/WorkspaceListResponse" } } } },
					400: { description: "Invalid workspace filter.", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
				},
			},
			post: {
				tags: ["Workspaces"],
				summary: "Create a workspace listing",
				description: "Creates a listing in pending review status. Requires the host role.",
				operationId: "createWorkspace",
				security: [{ bearerAuth: [] }],
				requestBody: {
					required: true,
					content: { "application/json": { schema: { $ref: "#/components/schemas/CreateWorkspaceRequest" } } },
				},
				responses: {
					201: { description: "Workspace created and submitted for review.", content: { "application/json": { schema: { $ref: "#/components/schemas/WorkspaceResponse" } } } },
					400: {
						description: "Workspace details failed validation.",
						content: {
							"application/json": {
								schema: { $ref: "#/components/schemas/ValidationErrorResponse" },
								example: {
									success: false,
									error: {
										message: "Validation failed",
										errors: {
											name: "Name must be at least 3 characters.",
											description: "Description must be at least 20 characters.",
											type: "Type must be at least 3 characters.",
											capacity: "Capacity must be a whole number of at least 1.",
											"pricing.amount": "Price amount must be a valid non-negative number.",
											location: "Location is required.",
											"location.address": "Location address is required.",
											city: "city is required.",
											state: "state is required.",
											country: "country is required.",
										},
									},
								},
							},
						},
					},
					401: { description: "A valid bearer token is required.", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
					403: { description: "Host role is required.", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
				},
			},
		},
		"/api/workspaces/mine": {
			get: {
				tags: ["Workspaces"],
				summary: "List the signed-in host's workspaces",
				description: "Returns all listings owned by the signed-in host, including pending, approved, rejected, and suspended listings.",
				operationId: "listMyWorkspaces",
				security: [{ bearerAuth: [] }],
				parameters: [
					{ name: "status", in: "query", schema: { type: "string", enum: ["pending", "approved", "rejected", "changes_requested", "suspended"] }, description: "Optionally filter this host's listings by moderation status." },
					{ name: "page", in: "query", schema: { type: "integer", minimum: 1, default: 1 } },
					{ name: "limit", in: "query", schema: { type: "integer", minimum: 1, maximum: 100, default: 20 } },
				],
				responses: {
					200: { description: "Host workspace listings with pagination and total counts by status in the analytics object.", content: { "application/json": { schema: { $ref: "#/components/schemas/WorkspaceListResponse" }, example: { success: true, data: [], analytics: { total: 8, pending: 2, approved: 4, rejected: 1, changes_requested: 1, suspended: 0 }, pagination: { page: 1, limit: 20, total: 8, totalPages: 1 } } } } },
					400: { description: "Invalid status or pagination values.", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" }, examples: { invalidStatus: { value: { success: false, error: { message: "status must be one of: pending, approved, rejected, changes_requested, suspended" } } }, invalidPagination: { value: { success: false, error: { message: "page must be a positive integer and limit must be between 1 and 100" } } } } } } },
					401: { description: "A valid bearer token is required.", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" }, example: { success: false, error: { message: "Invalid or expired token" } } } } },
					403: { description: "Host role is required.", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" }, example: { success: false, error: { message: "You don't have permission to perform this operation" } } } } },
				},
			},
		},
		"/api/workspaces/mine/{id}": {
			get: {
				tags: ["Workspaces"],
				summary: "Get details for one of my workspaces",
				description: "Returns the full listing, including images, status, and host-visible rejection or requested-change reason, regardless of moderation status. Only the owning host can access it.",
				operationId: "getMyWorkspaceById",
				security: [{ bearerAuth: [] }],
				parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", pattern: "^[0-9a-fA-F]{24}$" } }],
				responses: {
					200: { description: "Workspace details including images and moderation status.", content: { "application/json": { schema: { $ref: "#/components/schemas/WorkspaceResponse" }, example: { success: true, data: { _id: "66d7f3c8a23b1e0012345678", name: "Studio Space", status: "changes_requested", requestedChanges: "Please add clearer photos", images: [{ url: "https://example.com/space.jpg", publicId: "workspace-image" }] } } } } },
					400: { description: "Invalid workspace ID.", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" }, example: { success: false, error: { message: "Invalid workspace ID" } } } } },
					401: { description: "A valid bearer token is required.", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" }, example: { success: false, error: { message: "Invalid or expired token" } } } } },
					403: { description: "Host role is required.", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" }, example: { success: false, error: { message: "You don't have permission to perform this operation" } } } } },
					404: { description: "Workspace not found or not owned by this host.", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" }, example: { success: false, error: { message: "Workspace not found" } } } } },
				},
			},
		},
		"/api/workspaces/{id}": {
			get: {
				tags: ["Workspaces"],
				summary: "Get an approved workspace",
				operationId: "getWorkspace",
				parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", pattern: "^[0-9a-fA-F]{24}$", example: "66d7f3c8a23b1e0012345678" } }],
				responses: {
					200: { description: "Workspace details.", content: { "application/json": { schema: { $ref: "#/components/schemas/WorkspaceResponse" } } } },
					404: { description: "Approved workspace not found.", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
				},
			},
			put: {
				tags: ["Workspaces"],
				summary: "Update my workspace",
				description: "Updates editable listing fields. Ownership and moderation status cannot be changed here. Requires the owning host.",
				operationId: "updateWorkspace",
				security: [{ bearerAuth: [] }],
				parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", pattern: "^[0-9a-fA-F]{24}$", example: "66d7f3c8a23b1e0012345678" } }],
				requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/UpdateWorkspaceRequest" } } } },
				responses: {
					200: { description: "Workspace updated.", content: { "application/json": { schema: { $ref: "#/components/schemas/WorkspaceResponse" } } } },
					401: { description: "A valid bearer token is required.", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
					403: { description: "Only the owning host may update this workspace.", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
					404: { description: "Workspace not found.", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
				},
			},
			delete: {
				tags: ["Workspaces"],
				summary: "Delete my workspace",
				operationId: "deleteWorkspace",
				security: [{ bearerAuth: [] }],
				parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", pattern: "^[0-9a-fA-F]{24}$", example: "66d7f3c8a23b1e0012345678" } }],
				responses: {
					200: { description: "Workspace deleted.", content: { "application/json": { schema: { $ref: "#/components/schemas/MessageResponse" }, example: { success: true, message: "Workspace deleted successfully" } } } },
					401: { description: "A valid bearer token is required.", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
					403: { description: "Only the owning host may delete this workspace.", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
					404: { description: "Workspace not found.", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
				},
			},
		},
		"/api/workspaces/{id}/images": {
			post: {
				tags: ["Workspaces"],
				summary: "Upload workspace images",
				description: "Adds up to five images to a workspace owned by the signed-in host. Each image must be JPEG, PNG, or WEBP and no larger than 5 MB. Files are repeated under the images field. Changing images on an approved or rejected workspace moves it back to pending review, so it is hidden from public listings until approved again. Images cannot be changed while suspended.",
				operationId: "uploadWorkspaceImages",
				security: [{ bearerAuth: [] }],
				parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", pattern: "^[0-9a-fA-F]{24}$", example: "66d7f3c8a23b1e0012345678" } }],
				requestBody: {
					required: true,
					content: { "multipart/form-data": { schema: { type: "object", required: ["images"], properties: { images: { type: "array", maxItems: 5, items: { type: "string", format: "binary" }, description: "Repeat the images field for each JPEG, PNG, or WEBP file (maximum 5 MB each)." } } } } },
				},
				responses: {
					200: { description: "Workspace images uploaded.", content: { "application/json": { schema: { $ref: "#/components/schemas/WorkspaceResponse" }, example: { success: true, message: "Workspace images uploaded successfully", data: { _id: "66d7f3c8a23b1e0012345678", host: "66d7f3c8a23b1e0012345678", name: "Bright Studio", description: "A bright studio for workshops and meetings.", type: "studio", capacity: 8, pricing: { amount: 35, unit: "hour" }, amenities: [], location: { type: "Point", coordinates: [-73.9, 40.7], address: "123 Main Street" }, city: "New York", state: "New York", country: "United States", images: [{ url: "https://res.cloudinary.com/example/image/upload/workspace.jpg", publicId: "spaceshare/workspaces/workspace-image" }], isAvailable: true, status: "pending", rejectionReason: null, suspensionReason: null, submittedAt: "2026-10-12T12:00:00.000Z", reviewedAt: null, reviewedBy: null, bookingLockVersion: 0, createdAt: "2026-10-12T12:00:00.000Z", updatedAt: "2026-10-12T12:00:00.000Z", __v: 0 } } } } },
					400: { description: 'Error messages: "At least one image is required", "A workspace can have a maximum of 5 images", or "Images cannot be changed while a workspace is suspended". Multer upload errors are also returned as 400.', content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
					401: { description: "A valid bearer token is required.", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
					403: { description: 'Error message: "You do not have permission to modify this workspace".', content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
					404: { description: 'Error message: "Workspace not found".', content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
				},
			},
			delete: {
				tags: ["Workspaces"],
				summary: "Remove a workspace image",
				description: "Removes the image matching publicId. Removing an image from an approved or rejected workspace moves it back to pending review, so it is hidden from public listings until approved again. Images cannot be changed while suspended.",
				operationId: "removeWorkspaceImage",
				security: [{ bearerAuth: [] }],
				parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", pattern: "^[0-9a-fA-F]{24}$", example: "66d7f3c8a23b1e0012345678" } }],
				requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/RemoveWorkspaceImageRequest" }, example: { publicId: "spaceshare/workspaces/image-id" } } } },
				responses: {
					200: { description: "Workspace image removed.", content: { "application/json": { schema: { $ref: "#/components/schemas/WorkspaceResponse" }, example: { success: true, message: "Workspace image removed successfully", data: { _id: "66d7f3c8a23b1e0012345678", host: "66d7f3c8a23b1e0012345678", name: "Bright Studio", description: "A bright studio for workshops and meetings.", type: "studio", capacity: 8, pricing: { amount: 35, unit: "hour" }, amenities: [], location: { type: "Point", coordinates: [-73.9, 40.7], address: "123 Main Street" }, city: "New York", state: "New York", country: "United States", images: [], isAvailable: true, status: "pending", rejectionReason: null, suspensionReason: null, submittedAt: "2026-10-12T12:00:00.000Z", reviewedAt: null, reviewedBy: null, bookingLockVersion: 0, createdAt: "2026-10-12T12:00:00.000Z", updatedAt: "2026-10-12T12:00:00.000Z", __v: 0 } } } } },
					400: { description: 'Error messages: "publicId is required" or "Images cannot be changed while a workspace is suspended".', content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
					401: { description: "A valid bearer token is required.", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
					403: { description: 'Error message: "You do not have permission to modify this workspace".', content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
					404: { description: 'Error messages: "Workspace not found" or "Workspace image not found".', content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
				},
			},
		},
		"/api/workspaces/{workspaceId}/availability": {
			get: {
				tags: ["Availability"], summary: "List active workspace opening hours", operationId: "listWorkspaceAvailability",
				parameters: [{ name: "workspaceId", in: "path", required: true, schema: { type: "string" } }],
				responses: {
					200: {
						description: "Active availability rules for an approved workspace.",
						content: {
							"application/json": {
								schema: {
									type: "object",
									properties: {
										success: { type: "boolean" },
										data: { type: "array", items: { $ref: "#/components/schemas/Availability" } },
									},
								},
							},
						},
					},
					404: { description: "Workspace not found or not public." },
				},
			},
			post: {
				tags: ["Availability"],
				summary: "Create workspace availability",
				description: "Creates a recurring weekly rule or a specific-date rule for a workspace owned by the signed-in user.",
				operationId: "createAvailability",
				security: [{ bearerAuth: [] }],
				parameters: [{ name: "workspaceId", in: "path", required: true, schema: { type: "string" } }],
				requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/AvailabilityRequest" }, example: { type: "recurring", dayOfWeek: 1, startTime: "09:00", endTime: "17:00", minDurationMinutes: 60, bufferBefore: 0, bufferAfter: 15 } } } },
				responses: {
					201: { description: "Availability rule created.", content: { "application/json": { schema: { $ref: "#/components/schemas/Availability" } } } },
					400: { description: "Availability rule failed validation.", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
					401: { description: "A valid bearer token is required.", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
					403: { description: "Only the owning user may manage availability.", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
					404: { description: "Workspace not found.", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
				},
			},
		},
		"/api/workspaces/{workspaceId}/availability/{availabilityId}": {
			put: {
				tags: ["Availability"],
				summary: "Update workspace availability",
				operationId: "updateAvailability",
				security: [{ bearerAuth: [] }],
				parameters: [
					{ name: "workspaceId", in: "path", required: true, schema: { type: "string" } },
					{ name: "availabilityId", in: "path", required: true, schema: { type: "string" } },
				],
				requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/AvailabilityRequest" } } } },
				responses: {
					200: { description: "Availability rule updated.", content: { "application/json": { schema: { $ref: "#/components/schemas/Availability" } } } },
					400: { description: "Availability rule failed validation.", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
					401: { description: "A valid bearer token is required.", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
					403: { description: "Only the owning user may manage availability.", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
					404: { description: "Workspace or availability rule not found.", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
				},
			},
			delete: {
				tags: ["Availability"],
				summary: "Delete workspace availability",
				operationId: "deleteAvailability",
				security: [{ bearerAuth: [] }],
				parameters: [
					{ name: "workspaceId", in: "path", required: true, schema: { type: "string" } },
					{ name: "availabilityId", in: "path", required: true, schema: { type: "string" } },
				],
				responses: {
					200: { description: "Availability removed.", content: { "application/json": { schema: { $ref: "#/components/schemas/MessageResponse" }, example: { message: "Availability removed successfully." } } } },
					401: { description: "A valid bearer token is required.", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
					403: { description: "Only the owning user may manage availability.", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
					404: { description: "Workspace or availability rule not found.", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
				},
			},
		},
		"/api/workspaces/{workspaceId}/availability/manage": {
			get: { tags: ["Availability"], summary: "List all availability rules for the owning host", operationId: "listMyWorkspaceAvailability", security: [{ bearerAuth: [] }], parameters: [{ name: "workspaceId", in: "path", required: true, schema: { type: "string" } }], responses: { 200: { description: "Active and inactive rules for the host's workspace." }, 403: { description: "Only the owning host may read all rules." }, 404: { description: "Workspace not found." } } },
		},
		"/api/workspaces/{workspaceId}/availability/check": {
			get: {
				tags: ["Availability"],
				summary: "Check workspace availability",
				description: "Checks opening rules, blocked periods, active bookings, and every date in the interval.",
				operationId: "checkAvailability",
				parameters: [
					{ name: "workspaceId", in: "path", required: true, schema: { type: "string" } },
					{ name: "startDateTime", in: "query", required: true, schema: { type: "string", format: "date-time" } },
					{ name: "endDateTime", in: "query", required: true, schema: { type: "string", format: "date-time" } },
				],
				responses: {
					200: { description: "Availability result.", content: { "application/json": { schema: { $ref: "#/components/schemas/AvailabilityCheckResponse" } } } },
					400: { description: "Invalid date range.", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
				},
			},
		},
		"/api/workspaces/{workspaceId}/blocked-periods": {
			get: {
				tags: ["Blocked Periods"], summary: "List workspace blocked periods", operationId: "listBlockedPeriods", security: [{ bearerAuth: [] }],
				parameters: [{ name: "workspaceId", in: "path", required: true, schema: { type: "string" } }],
				responses: {
					200: { description: "The owning host's blocked periods, including cancelled periods." },
					403: { description: "Only the workspace host can read blocked periods." },
					404: { description: "Workspace not found." },
				},
			},
			post: {
				tags: ["Blocked Periods"],
				summary: "Create a blocked period",
				operationId: "createBlockedPeriod",
				security: [{ bearerAuth: [] }],
				parameters: [{ name: "workspaceId", in: "path", required: true, schema: { type: "string" } }],
				requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/BlockedPeriodRequest" }, example: { startDateTime: "2026-10-12T10:00:00.000Z", endDateTime: "2026-10-12T12:00:00.000Z", reason: "Private event" } } } },
				responses: {
					201: { description: "Blocked period created.", content: { "application/json": { schema: { $ref: "#/components/schemas/BlockedPeriod" } } } },
					400: { description: "Invalid blocked-period dates or reason.", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
					401: { description: "A valid bearer token is required.", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
					403: { description: "Only the owning user may manage blocked periods.", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
					404: { description: "Workspace not found.", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
				},
			},
		},
		"/api/workspaces/{workspaceId}/blocked-periods/{blockedPeriodId}": {
			put: {
				tags: ["Blocked Periods"],
				summary: "Update a blocked period",
				operationId: "updateBlockedPeriod",
				security: [{ bearerAuth: [] }],
				parameters: [
					{ name: "workspaceId", in: "path", required: true, schema: { type: "string" } },
					{ name: "blockedPeriodId", in: "path", required: true, schema: { type: "string" } },
				],
				requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/BlockedPeriodRequest" } } } },
				responses: {
					200: { description: "Blocked period updated.", content: { "application/json": { schema: { $ref: "#/components/schemas/BlockedPeriod" } } } },
					400: { description: "Invalid blocked-period dates or period is already cancelled.", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
					401: { description: "A valid bearer token is required.", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
					403: { description: "Only the owning user may manage blocked periods.", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
					404: { description: "Workspace or blocked period not found.", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
				},
			},
		},
		"/api/workspaces/{workspaceId}/blocked-periods/{blockedPeriodId}/cancel": {
			patch: {
				tags: ["Blocked Periods"],
				summary: "Cancel a blocked period",
				operationId: "cancelBlockedPeriod",
				security: [{ bearerAuth: [] }],
				parameters: [
					{ name: "workspaceId", in: "path", required: true, schema: { type: "string" } },
					{ name: "blockedPeriodId", in: "path", required: true, schema: { type: "string" } },
				],
				responses: {
					200: { description: "Blocked period cancelled.", content: { "application/json": { schema: { $ref: "#/components/schemas/BlockedPeriod" } } } },
					400: { description: "Blocked period is already cancelled.", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
					401: { description: "A valid bearer token is required.", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
					403: { description: "Only the owning user may manage blocked periods.", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
					404: { description: "Workspace or blocked period not found.", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
				},
			},
		},
		"/api/admin/workspaces/pending": {
			get: {
				tags: ["Workspace Moderation"],
				summary: "List pending workspace submissions",
				description: "Returns complete pending listing details, including image URLs, with host name and contact details for review. Requires an admin or superAdmin role.",
				operationId: "listPendingWorkspaces",
				security: [{ bearerAuth: [] }],
				parameters: [{ name: "reviewType", in: "query", schema: { type: "string", enum: ["new", "resubmitted"] } }],
				responses: {
					200: { description: "Pending workspace submissions.", content: { "application/json": { schema: { $ref: "#/components/schemas/WorkspaceListResponse" }, example: { success: true, data: [{ _id: "66d7f3c8a23b1e0012345678", name: "Studio Space", status: "pending", images: [{ url: "https://example.com/space.jpg", publicId: "workspace-image" }] }] } } } },
					400: { description: "Invalid reviewType filter.", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" }, example: { success: false, error: { message: "reviewType must be new or resubmitted" } } } } },
					401: { description: "A valid bearer token is required.", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" }, example: { success: false, error: { message: "Invalid or expired token" } } } } },
					403: { description: "Admin or superAdmin role is required.", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" }, example: { success: false, error: { message: "You don't have permission to perform this operation" } } } } },
				},
			},
		},
		"/api/admin/workspaces": {
			get: {
				tags: ["Workspace Moderation"],
				summary: "List all workspaces for admin",
				description: "Returns workspaces in every moderation status, including listing images and host contact details. Supports status filtering and pagination.",
				operationId: "listAllAdminWorkspaces",
				security: [{ bearerAuth: [] }],
				parameters: [
					{ name: "status", in: "query", schema: { type: "string", enum: ["pending", "approved", "rejected", "changes_requested", "suspended"] } },
					{ name: "page", in: "query", schema: { type: "integer", minimum: 1, default: 1 } },
					{ name: "limit", in: "query", schema: { type: "integer", minimum: 1, maximum: 100, default: 20 } },
				],
				responses: {
					200: { description: "All workspaces or those matching the requested status, with pagination.", content: { "application/json": { schema: { $ref: "#/components/schemas/WorkspaceListResponse" }, example: { success: true, data: [{ _id: "66d7f3c8a23b1e0012345678", name: "Studio Space", status: "pending", images: [{ url: "https://example.com/space.jpg", publicId: "workspace-image" }], host: { _id: "66d7f3c8a23b1e0098765432", name: "Host Name", email: "host@example.com" } }], pagination: { page: 1, limit: 20, total: 1, totalPages: 1 } } } } },
					400: { description: "Invalid status or pagination parameter.", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" }, examples: { invalidStatus: { value: { success: false, error: { message: "status must be one of: pending, approved, rejected, changes_requested, suspended" } } }, invalidPagination: { value: { success: false, error: { message: "page must be a positive integer and limit must be between 1 and 100" } } } } } } },
					401: { description: "A valid bearer token is required.", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" }, example: { success: false, error: { message: "Invalid or expired token" } } } } },
					403: { description: "Admin or superAdmin role is required.", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" }, example: { success: false, error: { message: "You don't have permission to perform this operation" } } } } },
				},
			},
		},
		"/api/admin/workspaces/{id}": {
			get: {
				tags: ["Workspace Moderation"],
				summary: "Get any workspace for admin review",
				operationId: "getWorkspaceForAdmin",
				security: [{ bearerAuth: [] }],
				parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
				responses: {
					200: { description: "Full workspace details and images for any moderation status.", content: { "application/json": { schema: { $ref: "#/components/schemas/WorkspaceResponse" }, example: { success: true, data: { _id: "66d7f3c8a23b1e0012345678", name: "Studio Space", status: "pending", images: [{ url: "https://example.com/space.jpg", publicId: "workspace-image" }] } } } } },
					400: { description: "Invalid workspace ID.", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" }, example: { success: false, error: { message: "Invalid identifier" } } } } },
					401: { description: "A valid bearer token is required.", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" }, example: { success: false, error: { message: "Invalid or expired token" } } } } },
					403: { description: "Admin or superAdmin role is required.", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" }, example: { success: false, error: { message: "You don't have permission to perform this operation" } } } } },
					404: { description: "Workspace not found.", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" }, example: { success: false, error: { message: "Workspace not found" } } } } },
				},
			},
		},
		"/api/admin/workspaces/{id}/request-changes": {
			patch: { tags: ["Workspace Moderation"], summary: "Request listing changes", operationId: "requestWorkspaceChanges", security: [{ bearerAuth: [] }], parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/WorkspaceReviewRequest" }, example: { reason: "Please add clearer photos", checklist: [{ item: "Images show the full space", passed: false }], notes: "Internal admin note" } } } }, responses: { 200: { description: "Listing marked changes_requested and host notified.", content: { "application/json": { schema: { $ref: "#/components/schemas/WorkspaceResponse" }, example: { success: true, message: "Workspace changes requested successfully" } } } }, 400: { description: "Invalid reason or review checklist." }, 403: { description: "Admin role required." }, 404: { description: "Workspace not found." } } },
		},
		"/api/admin/workspaces/{id}/approve": {
			patch: {
				tags: ["Workspace Moderation"],
				summary: "Approve a workspace",
				operationId: "approveWorkspace",
				security: [{ bearerAuth: [] }],
				parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", pattern: "^[0-9a-fA-F]{24}$", example: "66d7f3c8a23b1e0012345678" } }],
				requestBody: { required: false, description: "Optionally save the moderation checklist and internal notes with the approval.", content: { "application/json": { schema: { $ref: "#/components/schemas/WorkspaceReviewRequest" } } } },
				responses: {
					200: { description: "Workspace approved.", content: { "application/json": { schema: { $ref: "#/components/schemas/WorkspaceResponse" }, example: { success: true, message: "Workspace approved successfully", data: { _id: "66d7f3c8a23b1e0012345678", status: "approved" } } } } },
					400: { description: "Workspace is not pending review.", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
					401: { description: "A valid bearer token is required.", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
					403: { description: "Admin role is required.", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
					404: { description: "Workspace not found.", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
				},
			},
		},
		"/api/admin/workspaces/{id}/reject": {
			patch: {
				tags: ["Workspace Moderation"],
				summary: "Reject a workspace",
				operationId: "rejectWorkspace",
				security: [{ bearerAuth: [] }],
				parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", pattern: "^[0-9a-fA-F]{24}$", example: "66d7f3c8a23b1e0012345678" } }],
				requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/WorkspaceReviewRequest" }, example: { reason: "Listing needs more detail", checklist: [{ item: "Images clearly show the room", passed: false }], notes: "Internal note" } } } },
				responses: {
					200: { description: "Workspace rejected.", content: { "application/json": { schema: { $ref: "#/components/schemas/WorkspaceResponse" }, example: { success: true, message: "Workspace rejected successfully", data: { _id: "66d7f3c8a23b1e0012345678", status: "rejected", rejectionReason: "Listing needs more detail" } } } } },
					400: { description: "A valid reason is required or workspace is not pending review.", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
					401: { description: "A valid bearer token is required.", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
					403: { description: "Admin role is required.", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
					404: { description: "Workspace not found.", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
				},
			},
		},
		"/api/admin/workspaces/{id}/suspend": {
			patch: {
				tags: ["Workspace Moderation"],
				summary: "Suspend a workspace",
				operationId: "suspendWorkspace",
				security: [{ bearerAuth: [] }],
				parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", pattern: "^[0-9a-fA-F]{24}$", example: "66d7f3c8a23b1e0012345678" } }],
				requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/WorkspaceModerationReasonRequest" }, example: { reason: "Workspace no longer meets platform requirements" } } } },
				responses: {
					200: { description: "Workspace suspended.", content: { "application/json": { schema: { $ref: "#/components/schemas/WorkspaceResponse" }, example: { success: true, message: "Workspace suspended successfully", data: { _id: "66d7f3c8a23b1e0012345678", status: "suspended", suspensionReason: "Workspace no longer meets platform requirements" } } } } },
					400: { description: "A valid reason is required or workspace is not approved.", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
					401: { description: "A valid bearer token is required.", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
					403: { description: "Admin role is required.", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
					404: { description: "Workspace not found.", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
				},
			},
		},
		"/api/bookings": {
			get: {
				tags: ["Bookings"],
				summary: "List my bookings",
				description: "Customers see their bookings; hosts see bookings for their workspaces. Results are sorted by start time in ascending order.",
				operationId: "listBookings",
				security: [{ bearerAuth: [] }],
				responses: {
					200: { description: "Bookings sorted by start time.", content: { "application/json": { schema: { $ref: "#/components/schemas/BookingListResponse" } } } },
					401: { description: "A valid bearer token is required.", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
				},
			},
			post: {
				tags: ["Bookings"],
				summary: "Book an approved workspace",
				description: "Reserves an available slot using hourly or daily pricing. Instant-mode paid bookings start pending with a 15-minute payment hold; free bookings are confirmed immediately. Request-mode listings create a requested booking for host approval, which expires after 24 hours.",
				operationId: "createBooking",
				security: [{ bearerAuth: [] }],
				requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/CreateBookingRequest" }, example: { workspaceId: "66d7f3c8a23b1e0012345678", startTime: "2026-10-12T10:00:00.000Z", endTime: "2026-10-12T12:00:00.000Z", guestCount: 2 } } } },
				responses: {
					201: { description: "Booking created.", content: { "application/json": { schema: { $ref: "#/components/schemas/BookingResponse" }, example: { success: true, data: { booking: { _id: "66d7f3c8a23b1e0012345678", user: "66d7f3c8a23b1e0012345678", host: "66d7f3c8a23b1e0012345678", workspace: "66d7f3c8a23b1e0012345678", startTime: "2026-10-14T10:00:00.000Z", endTime: "2026-10-14T12:00:00.000Z", guestCount: 2, unitPrice: 35, priceUnit: "hour", amount: 70, status: "pending", paymentStatus: "pending", expiresAt: "2026-10-14T10:15:00.000Z", createdAt: "2026-10-14T10:00:00.000Z", updatedAt: "2026-10-14T10:00:00.000Z", __v: 0 } } } } } },
					400: { description: "Invalid booking dates or guest count, or the workspace is not approved and available.", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
					401: { description: "A valid bearer token is required.", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
					403: { description: "A workspace host cannot book their own workspace.", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
					404: { description: "Workspace not found.", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
					409: { description: "Requested time is outside availability, blocked, or already booked.", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" }, example: { success: false, error: { message: "Workspace is already booked for that time" } } } } },
				},
			},
		},
		"/api/bookings/admin": {
			get: { tags: ["Bookings"], summary: "List all bookings for admins", operationId: "listAdminBookings", security: [{ bearerAuth: [] }], parameters: [{ name: "page", in: "query", schema: { type: "integer", minimum: 1 } }, { name: "limit", in: "query", schema: { type: "integer", minimum: 1, maximum: 100 } }], responses: { 200: { description: "Bookings with guest, host, and workspace information." }, 403: { description: "Admin role required." } } },
		},
		"/api/bookings/{id}/accept": {
			patch: { tags: ["Bookings"], summary: "Accept a booking request", operationId: "acceptBookingRequest", security: [{ bearerAuth: [] }], parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], responses: { 200: { description: "Request accepted. Free bookings confirm immediately; paid bookings await payment for 15 minutes." }, 403: { description: "Only hosts can accept requests." }, 404: { description: "Pending booking request not found." }, 409: { description: "Workspace is no longer available for the requested slot." } } },
		},
		"/api/bookings/{id}/decline": {
			patch: { tags: ["Bookings"], summary: "Decline a booking request", operationId: "declineBookingRequest", security: [{ bearerAuth: [] }], parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], responses: { 200: { description: "Request declined and customer notified." }, 403: { description: "Only hosts can decline requests." }, 404: { description: "Pending booking request not found." } } },
		},
		"/api/bookings/{id}": {
			get: {
				tags: ["Bookings"],
				summary: "Get my booking",
				operationId: "getBooking",
				security: [{ bearerAuth: [] }],
				parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", pattern: "^[0-9a-fA-F]{24}$", example: "66d7f3c8a23b1e0012345678" } }],
				responses: {
					200: { description: "Booking details.", content: { "application/json": { schema: { $ref: "#/components/schemas/BookingResponse" } } } },
					401: { description: "A valid bearer token is required.", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
					400: { description: "Booking ID is invalid.", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
					404: { description: "Booking not found for this customer or host.", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
				},
			},
		},
		"/api/bookings/{id}/cancel": {
			patch: {
				tags: ["Bookings"],
				summary: "Cancel a booking or request a refund",
				description: "Cancels an unpaid pending booking immediately. A future confirmed paid booking is cancelled and its transaction is marked refund_pending for an admin to process manually; this endpoint does not send money to Paystack.",
				operationId: "cancelBooking",
				security: [{ bearerAuth: [] }],
				parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", pattern: "^[0-9a-fA-F]{24}$", example: "66d7f3c8a23b1e0012345678" } }],
				responses: {
					200: { description: "Booking cancelled.", content: { "application/json": { schema: { $ref: "#/components/schemas/BookingResponse" }, examples: { refundPending: { value: { success: true, message: "Booking cancelled; refund request is awaiting manual processing", data: { booking: { _id: "66d7f3c8a23b1e0012345678", status: "cancelled", paymentStatus: "refund_pending" } } } }, noRefund: { value: { success: true, message: "Booking cancelled; it is not eligible for a refund", data: { booking: { _id: "66d7f3c8a23b1e0012345678", status: "cancelled", paymentStatus: "paid" } } } }, unpaid: { value: { success: true, message: "Booking cancelled successfully", data: { booking: { _id: "66d7f3c8a23b1e0012345678", status: "cancelled", paymentStatus: "pending" } } } } } } } },
					401: { description: "A valid bearer token is required.", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
					404: { description: "Booking not found.", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
					409: { description: "Booking is not eligible for cancellation, has already started, or has no completed transaction to refund.", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
				},
			},
		},
		"/api/bookings/{id}/complete": {
			patch: {
				tags: ["Bookings"],
				summary: "Complete an ended booking",
				description: "Hosts can complete a paid confirmed booking after its scheduled end time. Zero-price bookings can also be completed.",
				operationId: "completeBooking",
				security: [{ bearerAuth: [] }],
				parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", pattern: "^[0-9a-fA-F]{24}$", example: "66d7f3c8a23b1e0012345678" } }],
				responses: {
					200: { description: "Booking completed.", content: { "application/json": { schema: { $ref: "#/components/schemas/BookingResponse" } } } },
					401: { description: "A valid bearer token is required.", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
					403: { description: "Only hosts can complete bookings.", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
					404: { description: "Booking not found for this host.", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
					409: { description: "Booking is not confirmed, has not ended, or has not been paid.", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
				},
			},
		},
		"/api/bookings/{id}/check-in": {
			post: {
				tags: ["Bookings"],
				summary: "Check in a guest",
				description: "The owning host submits the bookingCode printed in the guest's QR code. Only confirmed paid or zero-price bookings can be checked in, and each booking can be checked in once. No time-window restriction is currently enforced.",
				operationId: "checkInBooking",
				security: [{ bearerAuth: [] }],
				parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", pattern: "^[0-9a-fA-F]{24}$", example: "66d7f3c8a23b1e0012345678" } }],
				requestBody: { required: true, content: { "application/json": { schema: { type: "object", required: ["bookingCode"], properties: { bookingCode: { type: "string", pattern: "^[A-Z0-9_-]{12}$", example: "A7Q9M2K4P6R8", description: "The 12-character bookingCode encoded in the guest QR code." } } } } } },
				responses: {
					200: { description: "Guest checked in.", content: { "application/json": { schema: { $ref: "#/components/schemas/BookingResponse" } } } },
					400: { description: "Booking ID is invalid or bookingCode is missing.", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" }, examples: { invalidBookingId: { value: { success: false, error: { message: "Invalid booking ID" } } }, missingBookingCode: { value: { success: false, error: { message: "bookingCode is required" } } } } } } },
					401: { description: "A valid bearer token is required.", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" }, example: { success: false, error: { message: "Invalid or expired token" } } } } },
					403: { description: "Only hosts can check in bookings.", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" }, example: { success: false, error: { message: "Only hosts can check in bookings" } } } } },
					404: { description: "Booking not found for this host.", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" }, example: { success: false, error: { message: "Booking not found" } } } } },
					409: { description: "Booking is unpaid, cancelled, expired, otherwise ineligible, or already checked in.", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" }, example: { success: false, error: { message: "Booking has already been checked in" } } } } },
				},
			},
		},
		"/api/bookings/check-in": {
			post: {
				tags: ["Bookings"],
				summary: "Check in a guest by scanning their QR code",
				description: "The QR payload is the bookingCode. The signed-in host's ownership is checked against the booking record; the booking ID is not required.",
				operationId: "checkInBookingByQrCode",
				security: [{ bearerAuth: [] }],
				requestBody: { required: true, content: { "application/json": { schema: { type: "object", required: ["bookingCode"], properties: { bookingCode: { type: "string", pattern: "^[A-Z0-9_-]{12}$", example: "A7Q9M2K4P6R8", description: "The 12-character bookingCode encoded in the guest QR code." } } } } } },
				responses: {
					200: { description: "Guest checked in.", content: { "application/json": { schema: { $ref: "#/components/schemas/BookingResponse" } } } },
					400: { description: "bookingCode is required.", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" }, example: { success: false, error: { message: "bookingCode is required" } } } } },
					401: { description: "A valid bearer token is required.", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
					403: { description: "Only hosts can check in bookings.", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
					404: { description: "Booking code was not found for this host.", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
					409: { description: "Booking is not eligible or was already checked in.", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
				},
			},
		},
		"/api/notifications": {
			"get": {
				"tags": ["Notifications"],
				"summary": "List my notifications",
				"description": "Returns the signed-in user's notifications, newest first, with unread and pagination counts.",
				"operationId": "listNotifications",
				"security": [{ "bearerAuth": [] }],
				"parameters": [
					{ "name": "page", "in": "query", "schema": { "type": "integer", "minimum": 1, "default": 1 }, "description": "Page number." },
					{ "name": "limit", "in": "query", "schema": { "type": "integer", "minimum": 1, "maximum": 100, "default": 20 }, "description": "Number of results per page, capped at 100." }
				],
				"responses": {
					"200": {
						"description": "Notifications and unread/pagination counts.",
						"content": { "application/json": { "schema": { "$ref": "#/components/schemas/NotificationListResponse" } } }
					},
					"401": {
						"description": "A valid bearer token is required.",
						"content": { "application/json": { "schema": { "$ref": "#/components/schemas/ErrorResponse" } } }
					}
				}
			}
		},
		"/api/notifications/unread": {
			"get": {
				"tags": ["Notifications"],
				"summary": "List unread notifications",
				"description": "Returns only the unread notifications for the signed-in user.",
				"operationId": "listUnreadNotifications",
				"security": [{ "bearerAuth": [] }],
				"responses": {
					"200": {
						"description": "Unread notifications fetched successfully.",
						"content": { "application/json": { "schema": { "$ref": "#/components/schemas/NotificationListResponse" } } }
					},
					"401": {
						"description": "A valid bearer token is required.",
						"content": { "application/json": { "schema": { "$ref": "#/components/schemas/ErrorResponse" } } }
					}
				}
			}
		},
		"/api/notifications/read-all": {
			"patch": {
				"tags": ["Notifications"],
				"summary": "Mark all notifications as read",
				"description": "Marks all unread notifications belonging to the signed-in user as read.",
				"operationId": "markAllNotificationsAsRead",
				"security": [{ "bearerAuth": [] }],
				"responses": {
					"200": {
						"description": "All notifications marked as read successfully.",
						"content": { "application/json": { "schema": { "$ref": "#/components/schemas/SuccessResponse" } } }
					},
					"401": {
						"description": "A valid bearer token is required.",
						"content": { "application/json": { "schema": { "$ref": "#/components/schemas/ErrorResponse" } } }
					}
				}
			}
		},
		"/api/notifications/stream-token": {
			post: { tags: ["Notifications"], summary: "Create a short-lived EventSource token", operationId: "createNotificationStreamToken", security: [{ bearerAuth: [] }], responses: { 201: { description: "60-second token for opening the notifications stream." }, 401: { description: "Authentication required." } } },
		},
		"/api/notifications/stream": {
			"get": {
				"tags": ["Notifications"],
				"summary": "Stream live notifications",
				"description": "Open with the 60-second token from POST /api/notifications/stream-token as the token query parameter. Refresh the token after reconnecting.",
				"operationId": "streamNotifications",
				"parameters": [{ "name": "token", "in": "query", "required": true, "schema": { "type": "string" }, "description": "60-second token from POST /api/notifications/stream-token." }],
				"responses": {
					"200": {
						"description": "Live event stream authenticated by a short-lived query token.",
						"content": { "text/event-stream": { "schema": { "type": "string" } } }
					},
					"401": {
						"description": "A valid bearer token is required.",
						"content": { "application/json": { "schema": { "$ref": "#/components/schemas/ErrorResponse" } } }
					}
				}
			}
		},
		"/api/notifications/{id}/read": {
			"patch": {
				"tags": ["Notifications"],
				"summary": "Mark a notification as read",
				"description": "Marks a notification belonging to the signed-in user as read.",
				"operationId": "markNotificationAsRead",
				"security": [{ "bearerAuth": [] }],
				"parameters": [{ "name": "id", "in": "path", "required": true, "schema": { "type": "string" }, "description": "Notification ID." }],
				"responses": {
					"200": {
						"description": "Notification marked as read.",
						"content": { "application/json": { "schema": { "$ref": "#/components/schemas/MarkNotificationReadResponse" } } }
					},
					"400": {
						"description": "The notification ID is invalid.",
						"content": { "application/json": { "schema": { "$ref": "#/components/schemas/ErrorResponse" } } }
					},
					"401": {
						"description": "A valid bearer token is required.",
						"content": { "application/json": { "schema": { "$ref": "#/components/schemas/ErrorResponse" } } }
					},
					"404": {
						"description": "Notification not found for this user.",
						"content": { "application/json": { "schema": { "$ref": "#/components/schemas/ErrorResponse" } } }
					}
				}
			}
		},
		"/api/notifications/{id}": {
			"delete": {
				"tags": ["Notifications"],
				"summary": "Delete a notification",
				"description": "Permanently deletes a specific notification belonging to the signed-in user.",
				"operationId": "deleteNotification",
				"security": [{ "bearerAuth": [] }],
				"parameters": [{ "name": "id", "in": "path", "required": true, "schema": { "type": "string" }, "description": "Notification ID." }],
				"responses": {
					"200": {
						"description": "Notification deleted successfully.",
						"content": { "application/json": { "schema": { "$ref": "#/components/schemas/SuccessResponse" } } }
					},
					"400": {
						"description": "The notification ID is invalid.",
						"content": { "application/json": { "schema": { "$ref": "#/components/schemas/ErrorResponse" } } }
					},
					"401": {
						"description": "A valid bearer token is required.",
						"content": { "application/json": { "schema": { "$ref": "#/components/schemas/ErrorResponse" } } }
					},
					"404": {
						"description": "Notification not found for this user.",
						"content": { "application/json": { "schema": { "$ref": "#/components/schemas/ErrorResponse" } } }
					}
				}
			}
		},
		"/api/favourites": {
			get: {
				tags: ["Favourites"],
				summary: "List my favourite workspaces",
				description: "Returns the signed-in user's favourite workspaces, with workspace details populated.",
				operationId: "listMyFavourites",
				security: [{ bearerAuth: [] }],
				responses: {
					200: {
						description: "Favourite workspaces retrieved.",
						content: { "application/json": { schema: { $ref: "#/components/schemas/FavouriteListResponse" } } },
					},
					401: {
						description: "A valid bearer token is required.",
						content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } },
					},
				},
			},
		},
		"/api/favourites/{workspaceId}": {
			post: {
				tags: ["Favourites"],
				summary: "Add a workspace to favourites",
				description: "Saves the workspace as a favourite for the signed-in user.",
				operationId: "addFavourite",
				security: [{ bearerAuth: [] }],
				parameters: [{ name: "workspaceId", in: "path", required: true, schema: { type: "string" }, description: "ID of the workspace to favourite." }],
				responses: {
					201: {
						description: "Workspace added to favourites.",
						content: { "application/json": { schema: { $ref: "#/components/schemas/FavouriteResponse" } } },
					},
					400: {
						description: "The workspace ID is invalid.",
						content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } },
					},
					401: {
						description: "A valid bearer token is required.",
						content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } },
					},
					409: {
						description: "This workspace is already in favourites.",
						content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } },
					},
				},
			},
			delete: {
				tags: ["Favourites"],
				summary: "Remove a workspace from favourites",
				description: "Removes the workspace from the signed-in user's favourites.",
				operationId: "removeFavourite",
				security: [{ bearerAuth: [] }],
				parameters: [{ name: "workspaceId", in: "path", required: true, schema: { type: "string" }, description: "ID of the workspace to remove." }],
				responses: {
					200: {
						description: "Favourite removed.",
						content: { "application/json": { schema: { $ref: "#/components/schemas/RemoveFavouriteResponse" } } },
					},
					400: {
						description: "The workspace ID is invalid.",
						content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } },
					},
					401: {
						description: "A valid bearer token is required.",
						content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } },
					},
					404: {
						description: "Favourite not found for this user.",
						content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } },
					},
				},
			},
		},
		"/api/reviews": {
			post: {
				tags: ["Reviews"],
				summary: "Review a completed booking",
				description: "Submits a review for a completed booking owned by the signed-in user. Each booking can be reviewed once.",
				operationId: "createReview",
				security: [{ bearerAuth: [] }],
				requestBody: {
					required: true,
					content: { "application/json": { schema: { $ref: "#/components/schemas/CreateReviewRequest" }, example: { bookingId: "66d7f3c8a23b1e0012345678", rating: 5, comment: "Great workspace and service." } } },
				},
				responses: {
					201: { description: "Review submitted.", content: { "application/json": { schema: { $ref: "#/components/schemas/ReviewResponse" }, example: { success: true, message: "Review submitted successfully", data: { review: { _id: "66d7f3c8a23b1e0012345678", user: "66d7f3c8a23b1e0012345678", workspace: "66d7f3c8a23b1e0012345678", booking: "66d7f3c8a23b1e0012345678", rating: 5, comment: "Great workspace and service.", createdAt: "2026-10-12T12:00:00.000Z", updatedAt: "2026-10-12T12:00:00.000Z", __v: 0 } } } } } },
					400: { description: "Missing bookingId/rating or rating outside 1-5.", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
					401: { description: "A valid bearer token is required.", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
					404: { description: "Booking not found for this user.", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
					409: { description: "Booking is not completed or already has a review.", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
				},
			},
		},
		"/api/reviews/workspaces/{workspaceId}": {
			get: {
				tags: ["Reviews"],
				summary: "List reviews for a workspace",
					description: "Returns workspace reviews newest first, with reviewer names and avatars, using pagination.",
				operationId: "getWorkspaceReviews",
				parameters: [
					{ name: "workspaceId", in: "path", required: true, schema: { type: "string" }, description: "Workspace ID." },
					{ name: "page", in: "query", schema: { type: "integer", minimum: 1, default: 1 }, description: "Page number." },
					{ name: "limit", in: "query", schema: { type: "integer", minimum: 1, maximum: 100, default: 20 }, description: "Results per page, capped at 100." },
				],
				responses: {
					200: { description: "Workspace reviews and pagination details.", content: { "application/json": { schema: { $ref: "#/components/schemas/ReviewListResponse" } } } },
					400: { description: "Invalid workspace ID.", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
				},
			},
		},
		"/api/reviews/{id}": {
			delete: {
				tags: ["Reviews"],
				summary: "Delete my review",
				description: "Deletes a review owned by the signed-in user.",
				operationId: "deleteReview",
				security: [{ bearerAuth: [] }],
				parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", pattern: "^[0-9a-fA-F]{24}$", example: "66d7f3c8a23b1e0012345678" }, description: "Review ID." }],
				responses: {
					200: { description: "Review deleted.", content: { "application/json": { schema: { $ref: "#/components/schemas/DeleteReviewResponse" } } } },
					400: { description: "Invalid review ID.", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
					401: { description: "A valid bearer token is required.", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
					404: { description: "Review not found for this user.", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
				},
			},
		},
		"/api/users/{id}": {
			delete: {
				tags: ["Profile"],
				summary: "Delete a user account",
				description: "Deletes your own account, or another user's account when called by an administrator. Deletion is blocked while the user has an active booking.",
				operationId: "deleteUser",
				security: [{ bearerAuth: [] }],
				parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", pattern: "^[0-9a-fA-F]{24}$", example: "66d7f3c8a23b1e0012345678" }, description: "ID of the account to delete." }],
				responses: {
					200: {
						description: "User account deleted.",
						content: { "application/json": { schema: { $ref: "#/components/schemas/DeleteUserResponse" } } },
					},
					401: {
						description: "A valid bearer token is required.",
						content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } },
					},
					403: {
						description: "Only the account owner or an administrator may delete this account.",
						content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } },
					},
					404: {
						description: "User not found.",
						content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } },
					},
					409: {
						description: "The user has an active booking.",
						content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } },
					},
				},
			},
		},
		"/api/admin/invitations": {
			post: {
				tags: ["Admin"],
				summary: "Invite an administrator",
				description: "Creates an inactive admin account and emails an invitation link. Requires the superAdmin role.",
				operationId: "createAdminInvitation",
				security: [{ bearerAuth: [] }],
				requestBody: {
					required: true,
					content: { "application/json": { schema: { $ref: "#/components/schemas/CreateAdminInvitationRequest" }, example: { name: "Cypher Prince", email: "cypher@example.com", phone: "+1 555 010 2000" } } },
				},
				responses: {
					201: {
						description: "Invitation email sent. The invitation expires after 24 hours.",
						content: { "application/json": { schema: { $ref: "#/components/schemas/AdminInvitationResponse" } } },
					},
					400: { description: "Name, email, and phone are required.", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
					401: { description: "A valid bearer token is required.", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
					403: { description: "The superAdmin role is required.", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
					409: { description: "A user with this email already exists.", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
				},
			},
		},
		"/api/admin/invitations/complete": {
			post: {
				tags: ["Admin"],
				summary: "Complete an administrator invitation",
				description: "Activates the invited admin account and sets its password using the emailed invitation token.",
				operationId: "completeAdminInvitation",
				requestBody: {
					required: true,
					content: { "application/json": { schema: { $ref: "#/components/schemas/CompleteAdminInvitationRequest" }, example: { token: "invitation-token", password: "correct-horse-42" } } },
				},
				responses: {
					200: {
						description: "Admin account activated.",
						content: { "application/json": { schema: { $ref: "#/components/schemas/CompleteAdminInvitationResponse" } } },
					},
					400: { description: "Missing fields, password shorter than 8 characters, or invalid/expired invitation.", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
					404: { description: "Admin account not found.", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
				},
			},
		},
		"/api/admin/invitations/{id}/resend": {
			post: {
				tags: ["Admin"],
				summary: "Resend an administrator invitation",
				description: "Invalidates outstanding invitations and sends a fresh 24-hour invitation. Requires the superAdmin role.",
				operationId: "resendAdminInvitation",
				security: [{ bearerAuth: [] }],
				parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", pattern: "^[0-9a-fA-F]{24}$", example: "66d7f3c8a23b1e0012345678" }, description: "ID of the invited admin account." }],
				responses: {
					200: {
						description: "Invitation email resent.",
						content: { "application/json": { schema: { $ref: "#/components/schemas/ResendAdminInvitationResponse" } } },
					},
					400: { description: "User is not an admin or the account is already active.", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
					401: { description: "A valid bearer token is required.", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
					403: { description: "The superAdmin role is required.", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
					404: { description: "User not found.", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
				},
			},
		},
		"/api/admin/users": {
			get: {
				tags: ["Admin"],
				summary: "List users",
				description: "Returns users with pagination, filtering, search, and sorting. Admin users also include invitation status, expiry, and acceptance timestamp. Requires the admin or superAdmin role.",
				operationId: "listUsers",
				security: [{ bearerAuth: [] }],
				parameters: [
					{ name: "page", in: "query", schema: { type: "integer", minimum: 1, default: 1 }, description: "Page number." },
					{ name: "limit", in: "query", schema: { type: "integer", minimum: 1, maximum: 100, default: 20 }, description: "Results per page, capped at 100." },
					{ name: "role", in: "query", schema: { type: "string", enum: ["customer", "host", "admin", "superAdmin"] }, description: "Filter by user role." },
					{ name: "isActive", in: "query", schema: { type: "boolean" }, description: "Filter by account activation status." },
					{ name: "search", in: "query", schema: { type: "string" }, description: "Case-insensitive search across name, email, and phone." },
					{ name: "sortBy", in: "query", schema: { type: "string", enum: ["name", "email", "role", "createdAt", "updatedAt"], default: "createdAt" }, description: "Field used to sort results." },
					{ name: "order", in: "query", schema: { type: "string", enum: ["asc", "desc"], default: "desc" }, description: "Sort direction." },
				],
				responses: {
					200: {
						description: "Matching users, pagination details, and applied filters.",
						content: { "application/json": { schema: { $ref: "#/components/schemas/AdminUserListResponse" } } },
					},
					400: { description: "Invalid filter or sort parameter.", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
					401: { description: "A valid bearer token is required.", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
					403: { description: "The admin or superAdmin role is required.", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
				},
			},
		},
		"/api/admin/audit-logs": {
			get: { tags: ["Admin"], summary: "List admin audit actions", operationId: "listAuditLogs", security: [{ bearerAuth: [] }], parameters: [{ name: "page", in: "query", schema: { type: "integer", minimum: 1 } }, { name: "limit", in: "query", schema: { type: "integer", minimum: 1, maximum: 100 } }, { name: "action", in: "query", schema: { type: "string" } }, { name: "entityType", in: "query", schema: { type: "string" } }], responses: { 200: { description: "Audit log entries with actor details and pagination." }, 403: { description: "Admin role required." } } },
		},
		"/api/admin/analytics": {
			get: {
				tags: ["Admin"],
				summary: "Get admin analytics",
				description: "Returns overall user, host, and workspace totals plus booking and completed-revenue metrics for the requested date range. Requires the admin or superAdmin role. Defaults to the last 30 days, grouped by day.",
				operationId: "getAdminAnalytics",
				security: [{ bearerAuth: [] }],
				parameters: [
					{ name: "startDate", in: "query", schema: { type: "string", format: "date-time" }, description: "Inclusive start of the booking and revenue date range. Defaults to 30 days ago." },
					{ name: "endDate", in: "query", schema: { type: "string", format: "date-time" }, description: "Inclusive end of the booking and revenue date range. Defaults to now." },
					{ name: "groupBy", in: "query", schema: { type: "string", enum: ["day", "week", "month"], default: "day" }, description: "Interval used to group the revenue trend." },
				],
				responses: {
					200: {
						description: "Analytics summary and revenue trend.",
						content: { "application/json": { schema: { $ref: "#/components/schemas/AdminAnalyticsResponse" } } },
					},
					400: { description: "Invalid date range or groupBy value.", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
					401: { description: "A valid bearer token is required.", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
					403: { description: "The admin or superAdmin role is required.", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
				},
			},
		},
		"/api/admin/settings": {
			get: {
				tags: ["Admin"],
				summary: "Get platform settings",
				description: "Returns persisted platform-wide settings. Requires the superAdmin role.",
				operationId: "getPlatformSettings",
				security: [{ bearerAuth: [] }],
				responses: {
					200: { description: "Current platform settings.", content: { "application/json": { schema: { $ref: "#/components/schemas/PlatformSettingsResponse" } } } },
					401: { description: "A valid bearer token is required.", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
					403: { description: "The superAdmin role is required.", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
				},
			},
			patch: {
				tags: ["Admin"],
				summary: "Update platform settings",
				description: "Updates the fee used when payment verification creates a transaction. Percentage fees accept values from 0 to 100; fixed fees use the same currency units as the booking amount. Requires the superAdmin role.",
				operationId: "updatePlatformSettings",
				security: [{ bearerAuth: [] }],
				requestBody: {
					required: true,
					content: { "application/json": { schema: { $ref: "#/components/schemas/UpdatePlatformSettingsRequest" }, example: { platformFeeType: "percentage", platformFeeValue: 10 } } },
				},
				responses: {
					200: { description: "Platform settings updated.", content: { "application/json": { schema: { $ref: "#/components/schemas/PlatformSettingsResponse" } } } },
					400: { description: "Invalid fee type or value.", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
					401: { description: "A valid bearer token is required.", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
					403: { description: "The superAdmin role is required.", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
				},
			},
		},
		"/api/admin/users/{id}": {
			delete: {
				tags: ["Admin"],
				summary: "Delete an administrator account",
				description: "Permanently deletes a user whose role is admin. Only a superadmin may perform this operation.",
				operationId: "deleteAdmin",
				security: [{ bearerAuth: [] }],
				parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", pattern: "^[0-9a-fA-F]{24}$", example: "66d7f3c8a23b1e0012345678" }, description: "ID of the admin account to delete." }],
				responses: {
					200: {
						description: "Admin account deleted.",
						content: { "application/json": { schema: { $ref: "#/components/schemas/DeleteAdminResponse" } } },
					},
					400: { description: "The account ID is invalid.", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
					401: { description: "A valid bearer token is required.", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
					403: { description: "Only a superadmin may delete an admin account.", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
					404: { description: "User not found.", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
				},
			},
		},
		"/api/admin/users/{id}/deactivate": {
			patch: {
				tags: ["Admin"],
				summary: "Deactivate a user account",
				description: "Admins may deactivate customers and hosts only when they have no active booking. Superadmins may also deactivate admin accounts. A customer or host with an active paid booking cannot be deactivated.",
				operationId: "deactivateUser",
				security: [{ bearerAuth: [] }],
				parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", pattern: "^[0-9a-fA-F]{24}$", example: "66d7f3c8a23b1e0012345678" }, description: "ID of the account to deactivate." }],
				responses: {
					200: {
						description: "User account deactivated.",
						content: { "application/json": { schema: { $ref: "#/components/schemas/DeactivateUserResponse" } } },
					},
					401: { description: "A valid bearer token is required.", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
					403: { description: "Insufficient role to deactivate this account.", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
					404: { description: "User not found.", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
					409: { description: "The customer or host has an active booking or active paid booking.", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
				},
			},
		},
		"/api/auth/register": {
			post: {
				tags: ["Authentication"],
				summary: "Create an account",
				description:
					"Register an account (role defaults to customer; customer or host may also be selected at registration). Password accounts must verify the emailed 6-digit OTP before signing in. Users can also select customer or host after registration with PATCH /api/users/me/role.",
				operationId: "registerUser",
				requestBody: {
					required: true,
					content: {
						"application/json": {
							schema: { $ref: "#/components/schemas/RegisterRequest" },
							example: {
								name: "Prince Arinzechukwu",
								email: "test@test.com",
								phone: "08138602173",
								password: "12345678",
								role: "customer",
							},
						},
					},
				},
				responses: {
					201: {
						description: "User registered and verification code sent.",
						content: {
							"application/json": {
								schema: { $ref: "#/components/schemas/RegisterResponse" },
							},
						},
					},
					400: {
						description: "Missing or invalid registration details.",
						content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } },
					},
					409: {
						description: "An account already uses this email address.",
						content: {
							"application/json": {
								schema: { $ref: "#/components/schemas/ErrorResponse" },
							example: { success: false, error: { message: "An account already uses this email address" } },
							},
						},
					},
					429: { description: "Registration attempts exceeded the 10-request-per-15-minute IP limit.", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
					503: { description: "The account was created, but SMTP could not deliver the verification code; request a new code after the resend cooldown.", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
				},
			},
		},
		"/api/auth/email-verification/request": {
			post: {
				tags: ["Authentication"],
				summary: "Request an email verification OTP",
				description: "Sends a six-digit code to an unverified password account. Codes expire in 10 minutes; requests are limited to one per minute per account and five per 15 minutes per IP.",
				operationId: "requestEmailVerification",
				requestBody: { required: true, content: { "application/json": { schema: { type: "object", required: ["email"], properties: { email: { type: "string", format: "email", example: "jordan@example.com" } } } } } },
				responses: {
					200: { description: "Generic response to avoid account enumeration.", content: { "application/json": { schema: { $ref: "#/components/schemas/MessageResponse" }, example: { success: true, message: "If an unverified account uses that email, a verification code has been sent." } } } },
					400: { description: "Email is required.", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" }, example: { success: false, error: { message: "Email is required" } } } } },
					429: { description: "A verification request was made too recently or the IP rate limit was reached.", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
					503: { description: "SMTP delivery is unavailable.", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
				},
			},
		},
		"/api/auth/email-verification/verify": {
			post: {
				tags: ["Authentication"],
				summary: "Verify my email with an OTP",
				description: "Consumes a valid six-digit, single-use verification code before its 10-minute expiry.",
				operationId: "verifyEmail",
				requestBody: { required: true, content: { "application/json": { schema: { type: "object", required: ["email", "otp"], properties: { email: { type: "string", format: "email", example: "jordan@example.com" }, otp: { type: "string", pattern: "^\\d{6}$", example: "042731" } } } } } },
				responses: {
					200: { description: "Email verified.", content: { "application/json": { schema: { $ref: "#/components/schemas/MessageResponse" }, example: { success: true, message: "Email verified successfully. You can now sign in." } } } },
					400: { description: "Missing email/code or code invalid/expired.", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" }, examples: { missingFields: { value: { success: false, error: { message: "Email and a 6-digit verification code are required" } } }, invalidOrExpiredCode: { value: { success: false, error: { message: "Verification code is invalid or expired" } } } } } } },
					429: { description: "Verification attempts exceeded the 10-request-per-15-minute IP limit.", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
				},
			},
		},
		"/api/auth/login": {
			post: {
				tags: ["Authentication"],
				summary: "Sign in",
				description: "Exchange an email address and password for a bearer token.",
				operationId: "loginUser",
				requestBody: {
					required: true,
					content: {
						"application/json": {
							schema: { $ref: "#/components/schemas/LoginRequest" },
							example: { email: "test@test.com", password: "correct-horse-42" },
						},
					},
				},
				responses: {
					200: {
						description: "Login successful.",
						content: {
							"application/json": {
								schema: { $ref: "#/components/schemas/LoginResponse" },
							},
						},
					},
					400: {
						description: "Email and password are required.",
						content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } },
					},
					401: {
						description: "Invalid credentials.",
						content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" }, example: { success: false, error: { message: "Invalid credentials" } } } },
					},
					403: { description: "Email address has not been verified.", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" }, example: { success: false, error: { message: "Verify your email before signing in" } } } } },
					429: { description: "Sign-in attempts exceeded the shared 20-request-per-15-minute IP limit.", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
				},
			},
		},
		"/api/auth/google": {
			post: {
				tags: ["Authentication"],
				summary: "Register or sign in with Google",
				description: "Verifies a Google ID token, creates a customer account when needed, or links a verified email to an existing customer/host account. Returns the API JWT.",
				operationId: "googleAuth",
				requestBody: {
					required: true,
					content: { "application/json": { schema: { $ref: "#/components/schemas/ProviderIdTokenRequest" }, example: { idToken: "google-id-token" } } },
				},
				responses: {
					200: { description: "Google sign-in successful.", content: { "application/json": { schema: { $ref: "#/components/schemas/SocialAuthResponse" } } } },
					400: { description: "Google ID token is required.", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
					401: { description: "The token is invalid, the email is unverified, or the account is inactive.", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
					403: { description: "Social sign-in is not enabled for admin accounts.", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
					409: { description: "The email is already linked to a different provider identity.", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
					503: { description: "Google sign-in is not configured on the server.", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
					429: { description: "Sign-in attempts exceeded the shared 20-request-per-15-minute IP limit.", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
				},
			},
		},
		"/api/auth/apple": {
			post: {
				tags: ["Authentication"],
				summary: "Register or sign in with Apple",
				description: "Verifies an Apple identity token, creates a customer account when needed, or links a verified email to an existing customer/host account. On first authorization, send Apple's name when available. Returns the API JWT.",
				operationId: "appleAuth",
				requestBody: {
					required: true,
					content: { "application/json": { schema: { $ref: "#/components/schemas/AppleIdTokenRequest" }, example: { idToken: "apple-identity-token", name: "Jordan Lee" } } },
				},
				responses: {
					200: { description: "Apple sign-in successful.", content: { "application/json": { schema: { $ref: "#/components/schemas/SocialAuthResponse" } } } },
					400: { description: "Apple ID token is missing or name is invalid.", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
					401: { description: "The token is invalid, required verified claims are missing, or the account is inactive.", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
					403: { description: "Social sign-in is not enabled for admin accounts.", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
					409: { description: "The email is already linked to a different provider identity.", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
					503: { description: "Apple sign-in is not configured on the server.", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
					429: { description: "Sign-in attempts exceeded the shared 20-request-per-15-minute IP limit.", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
				},
			},
		},
		"/api/auth/forgot-password": {
			post: {
				tags: ["Authentication"],
				summary: "Request a password reset",
				description: "Attempts to send a one-hour reset link asynchronously if an active account uses the supplied email. The response is the same whether or not an account exists and does not confirm email delivery.",
				operationId: "forgotPassword",
				requestBody: {
					required: true,
					content: { "application/json": { schema: { $ref: "#/components/schemas/ForgotPasswordRequest" }, example: { email: "jordan@example.com" } } },
				},
				responses: {
					200: { description: "Generic response; reset email delivery is attempted asynchronously for eligible accounts.", content: { "application/json": { schema: { $ref: "#/components/schemas/PasswordResetMessageResponse" }, example: { success: true, message: "If an active account uses that email, password reset instructions have been sent." } } } },
					400: { description: "Email is required.", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
					429: { description: "Password reset requests exceeded the 5-request-per-15-minute IP limit.", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
				},
			},
		},
		"/api/auth/reset-password": {
			post: {
				tags: ["Authentication"],
				summary: "Reset a password",
				description: "Consumes a valid, unexpired reset token and sets a new password of at least 8 characters. Existing bearer tokens are invalidated.",
				operationId: "resetPassword",
				requestBody: {
					required: true,
					content: { "application/json": { schema: { $ref: "#/components/schemas/ResetPasswordRequest" }, example: { token: "password-reset-token", password: "new-correct-horse-42" } } },
				},
				responses: {
					200: { description: "Password reset successfully.", content: { "application/json": { schema: { $ref: "#/components/schemas/PasswordResetMessageResponse" } } } },
					400: { description: "Missing fields, password too short, or token invalid/expired.", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
					429: { description: "Password reset attempts exceeded the 10-request-per-15-minute IP limit.", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
				},
			},
		},
		"/api/auth/change-password": {
			patch: {
				tags: ["Authentication"],
				summary: "Change my password",
				description: "Changes the password for the signed-in account after verifying the current password. Other sessions are invalidated; a replacement API JWT is returned. Social-only accounts must use password reset to set their first password.",
				operationId: "changePassword",
				security: [{ bearerAuth: [] }],
				requestBody: {
					required: true,
					content: { "application/json": { schema: { $ref: "#/components/schemas/ChangePasswordRequest" }, example: { currentPassword: "old-correct-horse", newPassword: "new-correct-horse-42" } } },
				},
				responses: {
					200: { description: "Password changed; response contains a replacement JWT.", content: { "application/json": { schema: { $ref: "#/components/schemas/ChangePasswordResponse" } } } },
					400: { description: "Missing password fields, password too short, or new password matches the current password.", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
					401: { description: "Authentication is invalid or the current password is incorrect.", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
					409: { description: "Account has no local password or its password changed concurrently.", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
					429: { description: "Password change attempts exceeded the 10-request-per-15-minute IP limit.", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
				},
			},
		},
		"/api/auth/me": {
			get: {
				tags: ["Authentication"],
				summary: "Get the signed-in account",
				description: "Returns the account associated with the supplied bearer token.",
				operationId: "getAuthenticatedUser",
				security: [{ bearerAuth: [] }],
				responses: {
					200: {
						description: "The signed-in account.",
						content: { "application/json": { schema: { $ref: "#/components/schemas/UserResponse" }, example: { success: true, message: "User fetched successfully", data: { user: { _id: "66d7f3c8a23b1e0012345678", name: "Jordan Lee", email: "jordan@example.com", role: "customer", isActive: true, emailVerified: true } } } } },
					},
					401: {
						description: "A valid bearer token is required.",
						content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } },
					},
				},
			},
		},
		"/api/auth/logout": {
			post: {
				tags: ["Authentication"],
				summary: "Sign out",
				description: "Invalidates the signed-in user's bearer tokens. This also signs the user out on other devices.",
				operationId: "logoutUser",
				security: [{ bearerAuth: [] }],
				responses: {
					200: {
						description: "Logout successful.",
						content: {
							"application/json": {
								schema: { $ref: "#/components/schemas/MessageResponse" },
								example: { success: true, message: "Logout successful" },
							},
						},
					},
					401: {
						description: "A valid bearer token is required.",
						content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } },
					},
				},
			},
		},
		"/api/users/me": {
			get: {
				tags: ["Profile"],
				summary: "Get my profile",
				description: "Returns the profile for the signed-in user.",
				operationId: "getMyProfile",
				security: [{ bearerAuth: [] }],
				responses: {
					200: {
						description: "The signed-in user's profile.",
						content: { "application/json": { schema: { $ref: "#/components/schemas/UserResponse" } } },
					},
					401: {
						description: "A valid bearer token is required.",
						content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } },
					},
				},
			},
			patch: {
				tags: ["Profile"],
				summary: "Update my profile",
				description:
					"Update the name or phone number, and optionally replace the profile image. Images must be JPEG, PNG, or WEBP and no larger than 5 MB. Send this request as multipart/form-data when uploading an avatar.",
				operationId: "updateMyProfile",
				security: [{ bearerAuth: [] }],
				requestBody: {
					required: false,
					content: {
						"multipart/form-data": {
							schema: { $ref: "#/components/schemas/UpdateProfileMultipartRequest" },
							encoding: { avatar: { contentType: "image/jpeg, image/png, image/webp" } },
						},
						"application/json": {
							schema: { $ref: "#/components/schemas/UpdateProfileRequest" },
							example: { name: "Jordan L. Lee", phone: "+1 555 010 2001" },
						},
					},
				},
				responses: {
					200: {
						description: "Profile updated.",
						content: { "application/json": { schema: { $ref: "#/components/schemas/UserResponse" } } },
					},
					400: {
						description: "Invalid image type, image larger than 5 MB, or invalid profile data.",
						content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } },
					},
					401: {
						description: "A valid bearer token is required.",
						content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } },
					},
				},
			},
		},
		"/api/users/me/role": {
			patch: {
				tags: ["Profile"],
				summary: "Select my customer or host role",
				description: "Allows a signed-in non-privileged user to select customer or host after registration. Administrator roles cannot be assigned through this endpoint.",
				operationId: "selectMyRole",
				security: [{ bearerAuth: [] }],
				requestBody: { required: true, content: { "application/json": { schema: { type: "object", required: ["role"], properties: { role: { type: "string", enum: ["customer", "host"] } } }, example: { role: "host" } } } },
				responses: {
					200: { description: "Role selected.", content: { "application/json": { schema: { $ref: "#/components/schemas/UserResponse" } } } },
					400: { description: "Choose customer or host.", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" }, example: { success: false, error: { message: "Choose customer or host" } } } } },
					401: { description: "A valid bearer token is required.", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
					403: { description: "Privileged roles cannot be changed here.", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
				},
			},
		},
		"/api/payments/initialize": {
			post: {
				tags: ["Payments"],
				summary: "Initialize a booking payment",
				description: "Starts a Paystack payment for a pending booking owned by the signed-in user. Paystack returns to PAYSTACK_CALLBACK_URL or the first CLIENT_URL origin at /payment/callback.",
				operationId: "initializePayment",
				security: [{ bearerAuth: [] }],
				requestBody: {
					required: true,
					content: {
						"application/json": {
							schema: { $ref: "#/components/schemas/InitializePaymentRequest" },
							example: { bookingId: "66d7f3c8a23b1e0012345678" },
						},
					},
				},
				responses: {
					201: {
						description: "Payment initialized.",
						content: { "application/json": { schema: { $ref: "#/components/schemas/InitializePaymentResponse" } } },
					},
					400: {
						description: "bookingId is required.",
						content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } },
					},
					401: {
						description: "A valid bearer token is required.",
						content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } },
					},
					404: {
						description: "No unexpired pending booking was found for this user.",
						content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } },
					},
					502: {
						description: "Paystack could not initialize the payment.",
						content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } },
					},
					503: {
						description: "Paystack is not configured.",
						content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } },
					},
				},
			},
		},
		"/api/payments/verify/{reference}": {
			get: {
				tags: ["Payments"],
				summary: "Verify a payment",
				description: "Verifies a payment belonging to the signed-in user. Administrators may verify any payment reference.",
				operationId: "verifyPayment",
				security: [{ bearerAuth: [] }],
				parameters: [{ name: "reference", in: "path", required: true, schema: { type: "string" }, example: "sp_0f1e2d3c4b5a" }],
				responses: {
					200: {
						description: "Payment verification result.",
						content: { "application/json": { schema: { $ref: "#/components/schemas/VerifyPaymentResponse" } } },
					},
					401: {
						description: "A valid bearer token is required.",
						content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } },
					},
					402: {
						description: "Paystack has not confirmed a successful payment with the expected amount.",
						content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } },
					},
					404: {
						description: "Payment reference not found or not accessible to this user.",
						content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } },
					},
					503: {
						description: "Paystack is not configured.",
						content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } },
					},
				},
			},
		},
		"/api/payments/webhook": {
			post: {
				tags: ["Payments"],
				summary: "Receive a Paystack webhook",
				description: "Accepts Paystack webhook events. The x-paystack-signature header is validated against the raw request body.",
				operationId: "receivePaymentWebhook",
				parameters: [{ name: "x-paystack-signature", in: "header", required: true, schema: { type: "string" }, description: "Paystack HMAC SHA-512 signature." }],
				requestBody: {
					required: true,
					content: {
						"application/json": {
							schema: { type: "object", additionalProperties: true },
							example: { event: "charge.success", data: { reference: "sp_0f1e2d3c4b5a" } },
						},
					},
				},
				responses: {
					200: {
						description: "Webhook accepted.",
						content: { "application/json": { schema: { $ref: "#/components/schemas/WebhookResponse" } } },
					},
					401: {
						description: "The Paystack signature is missing or invalid.",
						content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } },
					},
				},
			},
		},
		"/api/payments/transactions": {
			get: {
				tags: ["Transactions"],
				summary: "List my host transactions",
				description: "Returns recorded host transaction amounts and fee breakdowns, newest first. This is transaction history, not a payout or withdrawal: no host transfer is initiated or tracked. Pagination defaults to page 1 with 20 results and is capped at 100 per page.",
				operationId: "listHostTransactions",
				security: [{ bearerAuth: [] }],
				parameters: [
					{ name: "page", in: "query", schema: { type: "integer", minimum: 1, default: 1 }, description: "Page number." },
					{ name: "limit", in: "query", schema: { type: "integer", minimum: 1, maximum: 100, default: 20 }, description: "Number of results per page." },
				],
				responses: {
					200: {
						description: "The host's transactions and pagination details.",
						content: { "application/json": { schema: { $ref: "#/components/schemas/TransactionListResponse" } } },
					},
					401: {
						description: "A valid bearer token is required.",
						content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } },
					},
				},
			},
		},
		"/api/payments/withdrawals/banks": {
			get: { tags: ["Host Withdrawals"], summary: "List supported Nigerian banks", operationId: "listWithdrawalBanks", security: [{ bearerAuth: [] }], responses: { 200: { description: "Banks available for Paystack transfers.", content: { "application/json": { schema: { type: "object", properties: { success: { type: "boolean", example: true }, data: { type: "object", properties: { banks: { type: "array", items: { $ref: "#/components/schemas/WithdrawalBank" } } } } } } } } }, 401: { description: "Authentication required.", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } }, 403: { description: "Host role required.", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } }, 502: { description: "Paystack bank list unavailable.", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } }, 503: { description: "Paystack is not configured.", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } } } },
		},
		"/api/payments/withdrawals/balance": {
			get: { tags: ["Host Withdrawals"], summary: "Get my available host balance", operationId: "getHostWithdrawalBalance", security: [{ bearerAuth: [] }], responses: { 200: { description: "Paid earnings from completed bookings, available 24 hours after completion, less pending or completed withdrawals, in NGN.", content: { "application/json": { schema: { $ref: "#/components/schemas/WithdrawalBalanceResponse" } } } }, 401: { description: "Authentication required.", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } }, 403: { description: "Host role required.", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } } } },
		},
		"/api/payments/withdrawals/account": {
			get: {
				tags: ["Host Withdrawals"], summary: "Get my saved payout bank account", operationId: "getHostPayoutAccount", security: [{ bearerAuth: [] }],
				responses: {
					200: { description: "Saved payout account, or null when none has been saved.", content: { "application/json": { schema: { $ref: "#/components/schemas/PayoutAccountResponse" }, example: { success: true, data: { payoutAccount: { bankName: "Guaranty Trust Bank", bankCode: "058", accountName: "Jordan Lee", accountLast4: "6789", verifiedAt: "2026-10-12T12:00:00.000Z" } } } } } },
					401: { description: "Authentication required.", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
					403: { description: "Host role required.", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
				},
			},
			put: {
				tags: ["Host Withdrawals"], summary: "Save or replace my payout bank account", description: "Paystack verifies the Nigerian account and creates a transfer recipient. Repeating this request replaces the account used for future withdrawals. The full account number is not stored by Library Management System.", operationId: "updateHostPayoutAccount", security: [{ bearerAuth: [] }],
				requestBody: { required: true, content: { "application/json": { schema: { type: "object", required: ["bankCode", "accountNumber"], properties: { bankCode: { type: "string", example: "058", description: "Paystack bank code returned by GET /api/payments/withdrawals/banks." }, accountNumber: { type: "string", pattern: "^\\d{10}$", example: "0123456789", description: "10-digit Nigerian NUBAN account number. It is sent to Paystack for verification and is not persisted." } } }, example: { bankCode: "058", accountNumber: "0123456789" } } } },
				responses: {
					200: { description: "Payout account saved or replaced.", content: { "application/json": { schema: { $ref: "#/components/schemas/PayoutAccountResponse" }, example: { success: true, data: { payoutAccount: { bankName: "Guaranty Trust Bank", bankCode: "058", accountName: "Jordan Lee", accountLast4: "6789", verifiedAt: "2026-10-12T12:00:00.000Z" } } } } } },
					400: { description: "Invalid account format or Paystack could not verify the account.", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" }, examples: { invalidNuban: { value: { success: false, error: { message: "A valid bank code and 10-digit Nigerian account number are required" } } }, unresolvedAccount: { value: { success: false, error: { message: "Paystack could not verify this bank account" } } } } } } },
					401: { description: "Authentication required.", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
					403: { description: "Host role required.", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
					502: { description: "Paystack could not verify the account due to a provider/network error or could not create its transfer recipient.", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" }, example: { success: false, error: { message: "Paystack could not save this bank account" } } } } },
					503: { description: "Paystack is not configured.", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" }, example: { success: false, error: { message: "Paystack is not configured" } } } } },
				},
			},
		},
		"/api/payments/withdrawals": {
			get: { tags: ["Host Withdrawals"], summary: "List my withdrawals", operationId: "listHostWithdrawals", security: [{ bearerAuth: [] }], parameters: [{ name: "page", in: "query", schema: { type: "integer", minimum: 1, default: 1 } }, { name: "limit", in: "query", schema: { type: "integer", minimum: 1, maximum: 100, default: 20 } }], responses: { 200: { description: "Host withdrawal history, available balance, and pagination.", content: { "application/json": { schema: { $ref: "#/components/schemas/WithdrawalListResponse" } } } }, 401: { description: "Authentication required.", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } }, 403: { description: "Host role required.", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } } } },
			post: {
				tags: ["Host Withdrawals"], summary: "Request a host withdrawal", description: "Uses the host's saved Paystack transfer recipient and reserves the amount against paid earnings from bookings completed at least 24 hours earlier. Pending transfers remain reserved until Paystack returns a conclusive status.", operationId: "createHostWithdrawal", security: [{ bearerAuth: [] }],
				requestBody: { required: true, content: { "application/json": { schema: { type: "object", required: ["amount"], properties: { amount: { type: "number", exclusiveMinimum: 0, multipleOf: 0.01, example: 12500, description: "Withdrawal amount in naira, with up to two decimal places." } } }, example: { amount: 12500 } } } },
				responses: {
					201: { description: "Transfer initiated or awaiting provider processing/OTP.", content: { "application/json": { schema: { $ref: "#/components/schemas/WithdrawalResponse" }, example: { success: true, data: { withdrawal: { _id: "66d7f3c8a23b1e0012345678", host: "66d7f3c8a23b1e0012345678", amount: 12500, currency: "NGN", bankName: "Guaranty Trust Bank", accountLast4: "6789", reference: "ssw_7e59a34c9c274f688c9a3ed572c25b20", transferCode: "TRF_8v9m2k1x", status: "pending", createdAt: "2026-10-12T12:00:00.000Z", updatedAt: "2026-10-12T12:00:02.000Z" } } } } } },
					400: { description: "Withdrawal amount must be positive with at most two decimal places.", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" }, example: { success: false, error: { message: "Withdrawal amount must be a positive amount with at most two decimal places" } } } } },
					401: { description: "Authentication required.", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" }, example: { success: false, error: { message: "Invalid or expired token" } } } } },
					403: { description: "Host role required.", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" }, example: { success: false, error: { message: "You don't have permission to perform this operation" } } } } },
					409: { description: "No payout account is saved, or the amount exceeds the available balance after the 24-hour completion hold and existing withdrawal reservations.", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" }, examples: { missingBank: { value: { success: false, error: { message: "Save a verified withdrawal bank account before requesting a withdrawal" } } }, insufficientBalance: { value: { success: false, error: { message: "Withdrawal amount exceeds your available host balance" } } } } } } },
					502: { description: "Paystack could not create the recipient or initiate the transfer.", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" }, example: { success: false, error: { message: "Paystack could not initiate the transfer" } } } } },
					503: { description: "Paystack is not configured.", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" }, example: { success: false, error: { message: "Paystack is not configured" } } } } },
				},
			},
		},
		"/api/payments/withdrawals/{id}": {
			get: { tags: ["Host Withdrawals"], summary: "Get and reconcile a withdrawal", operationId: "getHostWithdrawal", security: [{ bearerAuth: [] }], parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", pattern: "^[0-9a-fA-F]{24}$", example: "66d7f3c8a23b1e0012345678" } }], responses: { 200: { description: "Withdrawal with the latest Paystack status.", content: { "application/json": { schema: { $ref: "#/components/schemas/WithdrawalResponse" } } } }, 400: { description: "Withdrawal ID is not a valid MongoDB ObjectId.", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" }, example: { success: false, error: { message: "Invalid withdrawal ID" } } } } }, 401: { description: "Authentication required.", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } }, 403: { description: "Host role required.", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } }, 404: { description: "Withdrawal not found.", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } } } },
		},
		"/api/payments/admin/withdrawals/{id}/finalize": {
			post: { tags: ["Host Withdrawals"], summary: "Finalize a Paystack OTP-protected transfer", description: "Administrator-only. Paystack sends transfer approval OTP to the Paystack account contact, not the host.", operationId: "finalizeHostWithdrawal", security: [{ bearerAuth: [] }], parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", pattern: "^[0-9a-fA-F]{24}$", example: "66d7f3c8a23b1e0012345678" } }], requestBody: { required: true, content: { "application/json": { schema: { type: "object", required: ["otp"], properties: { otp: { type: "string", pattern: "^\\d{6}$", example: "482916", description: "Six-digit OTP sent by Paystack to the platform account contact." } } }, example: { otp: "482916" } } } }, responses: { 200: { description: "Transfer finalization submitted with the updated provider status.", content: { "application/json": { schema: { $ref: "#/components/schemas/WithdrawalResponse" }, example: { success: true, data: { withdrawal: { _id: "66d7f3c8a23b1e0012345678", host: "66d7f3c8a23b1e0012345678", amount: 12500, currency: "NGN", bankName: "Guaranty Trust Bank", accountLast4: "6789", reference: "ssw_7e59a34c9c274f688c9a3ed572c25b20", transferCode: "TRF_8v9m2k1x", status: "pending", createdAt: "2026-10-12T12:00:00.000Z", updatedAt: "2026-10-12T12:00:02.000Z" } } } } } }, 400: { description: "Withdrawal ID is invalid, OTP is malformed, or Paystack rejected the code.", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" }, examples: { invalidId: { value: { success: false, error: { message: "Invalid withdrawal ID" } } }, invalidFormat: { value: { success: false, error: { message: "A 6-digit Paystack transfer OTP is required" } } }, rejectedByPaystack: { value: { success: false, error: { message: "Paystack could not finalize the transfer with that OTP" } } } } } } }, 401: { description: "Authentication required.", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } }, 403: { description: "Admin role required.", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } }, 404: { description: "Withdrawal not found.", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" }, example: { success: false, error: { message: "Withdrawal not found" } } } } }, 409: { description: "Transfer is not awaiting OTP.", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" }, example: { success: false, error: { message: "Withdrawal is not awaiting a Paystack OTP" } } } } } } },
		},
		"/api/payments/admin/withdrawals": {
			get: { tags: ["Host Withdrawals"], summary: "List all host withdrawals for admins", operationId: "listAdminWithdrawals", security: [{ bearerAuth: [] }], parameters: [{ name: "page", in: "query", schema: { type: "integer", minimum: 1 } }, { name: "limit", in: "query", schema: { type: "integer", minimum: 1, maximum: 100 } }, { name: "status", in: "query", schema: { type: "string" } }], responses: { 200: { description: "Withdrawals with host details and pagination." }, 403: { description: "Admin role required." } } },
		},
		"/api/payments/admin/transactions": {
			get: {
				tags: ["Admin Transactions"],
				summary: "List all transactions",
				description: "Returns all transactions newest first with booking, payment, and host details populated. Requires the admin or superAdmin role.",
				operationId: "listAdminTransactions",
				security: [{ bearerAuth: [] }],
				parameters: [
					{ name: "page", in: "query", schema: { type: "integer", minimum: 1, default: 1 }, description: "Page number." },
					{ name: "limit", in: "query", schema: { type: "integer", minimum: 1, maximum: 100, default: 20 }, description: "Number of results per page." },
				],
				responses: {
					200: {
						description: "Transactions and pagination details.",
						content: { "application/json": { schema: { $ref: "#/components/schemas/TransactionListResponse" } } },
					},
					401: { description: "A valid bearer token is required.", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
					403: { description: "The admin or superAdmin role is required.", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
				},
			},
		},
		"/api/payments/admin": {
			get: {
				tags: ["Transactions"],
				summary: "List all payments",
				description: "Returns all payments newest first, with booking and user data populated. Requires the administrator role. Pagination defaults to page 1 with 20 results and is capped at 100 per page.",
				operationId: "listAdminPayments",
				security: [{ bearerAuth: [] }],
				parameters: [
					{ name: "page", in: "query", schema: { type: "integer", minimum: 1, default: 1 }, description: "Page number." },
					{ name: "limit", in: "query", schema: { type: "integer", minimum: 1, maximum: 100, default: 20 }, description: "Number of results per page." },
				],
				responses: {
					200: {
						description: "All payments and pagination details.",
						content: { "application/json": { schema: { $ref: "#/components/schemas/PaymentListResponse" } } },
					},
					401: {
						description: "A valid bearer token is required.",
						content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } },
					},
					403: {
						description: "Administrator role is required.",
						content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } },
					},
				},
			},
		},
		"/api/payments/admin/transactions/{id}/refund": {
			patch: {
				tags: ["Transactions"],
				summary: "Mark a transaction as refunded",
				description: "Records completion of a manual refund for a transaction awaiting refund. Updates the transaction, payment, and booking payment status. Requires the administrator role.",
				operationId: "markTransactionRefunded",
				security: [{ bearerAuth: [] }],
				parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", pattern: "^[0-9a-fA-F]{24}$", example: "66d7f3c8a23b1e0012345678" }, description: "Transaction ID." }],
				requestBody: {
					required: false,
					content: { "application/json": { schema: { type: "object", properties: { reason: { type: "string", maxLength: 500, example: "Booking cancelled by host" } } } } },
				},
				responses: {
					200: {
						description: "Transaction marked as refunded.",
						content: { "application/json": { schema: { $ref: "#/components/schemas/RefundResponse" } } },
					},
					400: {
						description: "Refund reason must be a non-empty string of at most 500 characters.",
						content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } },
					},
					401: {
						description: "A valid bearer token is required.",
						content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } },
					},
					403: {
						description: "Administrator role is required.",
						content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } },
					},
					404: {
						description: "Transaction not found.",
						content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } },
					},
					409: {
						description: "Transaction is not awaiting a manual refund.",
						content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } },
					},
				},
			},
		},
	},
	components: {
		securitySchemes: {
			bearerAuth: {
				type: "http",
				scheme: "bearer",
				bearerFormat: "JWT",
				description: "Use the token returned by POST /api/auth/login.",
			},
		},
		schemas: {
			UpdatePlatformSettingsRequest: {
				type: "object",
				required: ["platformFeeType", "platformFeeValue"],
				properties: {
					platformFeeType: { type: "string", enum: ["percentage", "fixed"], example: "percentage" },
					platformFeeValue: { type: "number", minimum: 0, example: 10, description: "For percentage fees, 0-100. For fixed fees, amount in the booking currency." },
				},
			},
			PlatformSettingsResponse: {
				type: "object",
				properties: {
					success: { type: "boolean", example: true },
					data: {
						type: "object",
						properties: {
							settings: {
								type: "object",
								properties: {
									platformFeeType: { type: "string", enum: ["percentage", "fixed"], example: "percentage" },
									platformFeeValue: { type: "number", minimum: 0, example: 10 },
									createdAt: { type: "string", format: "date-time" },
									updatedAt: { type: "string", format: "date-time" },
								},
							},
						},
					},
				},
			},
			AdminAnalyticsResponse: {
				type: "object",
				properties: {
					success: { type: "boolean", example: true },
					data: {
						type: "object",
						properties: {
							range: {
								type: "object",
								properties: {
									startDate: { type: "string", format: "date-time" },
									endDate: { type: "string", format: "date-time" },
									groupBy: { type: "string", enum: ["day", "week", "month"] },
								},
							},
							overview: {
								type: "object",
								properties: {
									totalUsers: { type: "integer", example: 120 },
									totalHosts: { type: "integer", example: 25 },
									totalWorkspaces: { type: "integer", example: 40 },
									totalBookings: { type: "integer", example: 85 },
								},
							},
							bookings: {
								type: "object",
								properties: {
									byStatus: { type: "object", additionalProperties: { type: "integer" }, example: { pending: 5, confirmed: 60, cancelled: 20 } },
								},
							},
							earnings: {
								type: "object",
								properties: {
									grossRevenue: { type: "number", example: 125000 },
									platformFees: { type: "number", example: 12500 },
									hostPayouts: { type: "number", example: 112500 },
									completedCount: { type: "integer", example: 20 },
								},
							},
							revenueTrend: {
								type: "array",
								items: {
									type: "object",
									properties: {
										date: { type: "string", example: "2026-10-01" },
										gross: { type: "number", example: 12500 },
										fees: { type: "number", example: 1250 },
									},
								},
							},
						},
					},
				},
			},
			AvailabilityRequest: {
				type: "object",
				required: ["type", "startTime", "endTime"],
				properties: {
					type: { type: "string", enum: ["recurring", "specific_date"] },
					dayOfWeek: { type: "integer", minimum: 0, maximum: 6, description: "Required for recurring rules; 0 is Sunday." },
					date: { type: "string", format: "date", description: "Required for specific_date rules." },
					startTime: { type: "string", pattern: "^([01]\\d|2[0-3]):[0-5]\\d$", example: "09:00" },
					endTime: { type: "string", pattern: "^([01]\\d|2[0-3]):[0-5]\\d$|^24:00$", example: "17:00", description: "May be 24:00 to end at midnight." },
					minDurationMinutes: { type: "integer", minimum: 1 },
					maxDurationMinutes: { type: "integer", minimum: 1 },
					bufferBefore: { type: "integer", minimum: 0, default: 0 },
					bufferAfter: { type: "integer", minimum: 0, default: 0 },
					status: { type: "string", enum: ["active", "inactive"] },
				},
			},
			Availability: {
				type: "object",
				properties: {
					_id: { type: "string", pattern: "^[0-9a-fA-F]{24}$", example: "66d7f3c8a23b1e0012345678" },
					workspace: { type: "string" },
					type: { type: "string", enum: ["recurring", "specific_date"] },
					dayOfWeek: { type: "integer", minimum: 0, maximum: 6, nullable: true },
					date: { type: "string", format: "date-time", nullable: true },
					startTime: { type: "string", example: "09:00" },
					endTime: { type: "string", example: "17:00" },
					minDurationMinutes: { type: "integer", nullable: true },
					maxDurationMinutes: { type: "integer", nullable: true },
					bufferBefore: { type: "integer", example: 0 },
					bufferAfter: { type: "integer", example: 15 },
					status: { type: "string", enum: ["active", "inactive"] },
					createdAt: { type: "string", format: "date-time" },
					updatedAt: { type: "string", format: "date-time" },
				},
			},
			AvailabilityCheckResponse: {
				type: "object",
				properties: {
					available: { type: "boolean", example: false },
					reason: { type: "string", nullable: true },
					availabilityRuleId: { type: "string", nullable: true },
					availabilityRuleIds: { type: "array", items: { type: "string" } },
					conflict: { type: "object", nullable: true, additionalProperties: true },
				},
			},
			BlockedPeriodRequest: {
				type: "object",
				required: ["startDateTime", "endDateTime"],
				properties: {
					startDateTime: { type: "string", format: "date-time" },
					endDateTime: { type: "string", format: "date-time" },
					reason: { type: "string", maxLength: 1000 },
				},
			},
			BlockedPeriod: {
				type: "object",
				properties: {
					_id: { type: "string", pattern: "^[0-9a-fA-F]{24}$", example: "66d7f3c8a23b1e0012345678" },
					workspace: { type: "string" },
					startDateTime: { type: "string", format: "date-time" },
					endDateTime: { type: "string", format: "date-time" },
					reason: { type: "string", nullable: true },
					status: { type: "string", enum: ["active", "cancelled"] },
					createdBy: { type: "string" },
					createdAt: { type: "string", format: "date-time" },
					updatedAt: { type: "string", format: "date-time" },
				},
			},
			RemoveWorkspaceImageRequest: {
				type: "object",
				required: ["publicId"],
				properties: { publicId: { type: "string", example: "spaceshare/workspaces/image-id" } },
			},
			WorkspaceModerationReasonRequest: {
				type: "object",
				required: ["reason"],
				properties: { reason: { type: "string", minLength: 1, maxLength: 500 } },
			},
			WorkspaceReviewRequest: {
				type: "object",
				properties: {
					reason: { type: "string", minLength: 1, maxLength: 500 },
					notes: { type: "string", maxLength: 3000, description: "Internal admin-only review notes." },
					checklist: { type: "array", maxItems: 10, items: { type: "object", required: ["item", "passed"], properties: { item: { type: "string" }, passed: { type: "boolean" } } } },
				},
			},
			CreateWorkspaceRequest: {
				type: "object",
				required: ["name", "description", "type", "capacity", "pricing", "location", "city", "state", "country"],
				properties: {
					name: { type: "string", minLength: 3, maxLength: 150, example: "Bright Studio" },
					description: { type: "string", minLength: 20, maxLength: 2000 },
					type: { type: "string", maxLength: 100, example: "studio" },
					capacity: { type: "integer", minimum: 1, example: 8 },
					pricing: { type: "object", required: ["amount", "unit"], properties: { amount: { type: "number", minimum: 0, example: 35 }, unit: { type: "string", enum: ["hour", "day"], example: "hour" } } },
					amenities: { type: "array", items: { type: "string" } },
					activities: { type: "array", items: { type: "string" }, example: ["photoshoots", "workshops"] },
					bookingMode: { type: "string", enum: ["instant", "request"], default: "instant" },
					neighborhood: { type: "string", maxLength: 100 },
					location: {
						type: "object",
						required: ["coordinates", "address"],
						properties: {
							type: { type: "string", enum: ["Point"], default: "Point" },
							coordinates: { type: "array", minItems: 2, maxItems: 2, items: { type: "number" }, example: [-73.9, 40.7] },
							address: { type: "string", maxLength: 300, example: "123 Main Street" },
						},
					},
					city: { type: "string", maxLength: 100 },
					state: { type: "string", maxLength: 100 },
					country: { type: "string", maxLength: 100 },
				},
			},
			UpdateWorkspaceRequest: {
				type: "object",
				properties: {
					name: { type: "string", minLength: 3, maxLength: 150 },
					description: { type: "string", minLength: 20, maxLength: 2000 },
					type: { type: "string", maxLength: 100 },
					capacity: { type: "integer", minimum: 1 },
					pricing: { type: "object", properties: { amount: { type: "number", minimum: 0 }, unit: { type: "string", enum: ["hour", "day"] } } },
					amenities: { type: "array", items: { type: "string" } },
					activities: { type: "array", items: { type: "string" } },
					bookingMode: { type: "string", enum: ["instant", "request"] },
					neighborhood: { type: "string", maxLength: 100 },
					location: { $ref: "#/components/schemas/CreateWorkspaceRequest/properties/location" },
					city: { type: "string", maxLength: 100 },
					state: { type: "string", maxLength: 100 },
					country: { type: "string", maxLength: 100 },
					isAvailable: { type: "boolean" },
				},
			},
			Workspace: {
				type: "object",
				properties: {
					_id: { type: "string", example: "66d7f3c8a23b1e0012345678" },
					host: { oneOf: [{ type: "string" }, { $ref: "#/components/schemas/User" }] },
					name: { type: "string", example: "Bright Studio" },
					description: { type: "string" },
					type: { type: "string", minLength: 3, maxLength: 100, example: "studio", description: "Free-form workspace type; the backend does not define an enum." },
					capacity: { type: "integer", example: 8 },
					pricing: { type: "object", properties: { amount: { type: "number", example: 35 }, unit: { type: "string", enum: ["hour", "day"], example: "hour" } } },
					amenities: { type: "array", items: { type: "string" } },
					activities: { type: "array", items: { type: "string" } },
					bookingMode: { type: "string", enum: ["instant", "request"] },
					neighborhood: { type: "string", nullable: true },
					location: { $ref: "#/components/schemas/CreateWorkspaceRequest/properties/location" },
					city: { type: "string" },
					state: { type: "string" },
					country: { type: "string" },
					images: { type: "array", maxItems: 5, items: { type: "object", properties: { url: { type: "string", format: "uri" }, publicId: { type: "string" } } } },
					isAvailable: { type: "boolean", example: true },
					bookingLockVersion: { type: "integer", example: 0 },
					status: { type: "string", enum: ["pending", "approved", "rejected", "changes_requested", "suspended"] },
					rejectionReason: { type: "string", nullable: true },
					requestedChanges: { type: "string", nullable: true },
					submissionCount: { type: "integer", example: 1 },
					reviewChecklist: { type: "array", items: { type: "object", properties: { item: { type: "string" }, passed: { type: "boolean" } } } },
					moderationNotes: { type: "string", nullable: true },
					suspensionReason: { type: "string", nullable: true },
					submittedAt: { type: "string", format: "date-time", nullable: true },
					reviewedAt: { type: "string", format: "date-time", nullable: true },
					reviewedBy: { type: "string", nullable: true },
					createdAt: { type: "string", format: "date-time" },
					updatedAt: { type: "string", format: "date-time" },
					__v: { type: "integer", example: 0 },
				},
			},
			WorkspaceResponse: {
				type: "object",
				properties: {
					success: { type: "boolean", example: true },
					message: { type: "string", nullable: true },
					data: { $ref: "#/components/schemas/Workspace" },
				},
			},
			WorkspaceListResponse: {
				type: "object",
				properties: {
					success: { type: "boolean", example: true },
					data: { type: "array", items: { $ref: "#/components/schemas/Workspace" } },
					analytics: { type: "object", description: "Host workspace totals by moderation status; present on GET /api/workspaces/mine.", properties: { total: { type: "integer" }, pending: { type: "integer" }, approved: { type: "integer" }, rejected: { type: "integer" }, changes_requested: { type: "integer" }, suspended: { type: "integer" } } },
					pagination: { $ref: "#/components/schemas/Pagination" },
				},
			},
			CreateBookingRequest: {
				type: "object",
				required: ["workspaceId", "startTime", "endTime"],
				properties: {
					workspaceId: { type: "string", example: "66d7f3c8a23b1e0012345678" },
					startTime: { type: "string", format: "date-time", example: "2026-10-12T10:00:00.000Z" },
					endTime: { type: "string", format: "date-time", example: "2026-10-12T12:00:00.000Z" },
					guestCount: { type: "integer", minimum: 1, default: 1, example: 2 },
				},
			},
			Booking: {
				type: "object",
				properties: {
					_id: { type: "string", example: "66d7f3c8a23b1e0012345678" },
					user: { oneOf: [{ type: "string" }, { $ref: "#/components/schemas/User" }] },
					host: { oneOf: [{ type: "string" }, { $ref: "#/components/schemas/User" }] },
					workspace: { oneOf: [{ type: "string" }, { $ref: "#/components/schemas/Workspace" }] },
					startTime: { type: "string", format: "date-time" },
					endTime: { type: "string", format: "date-time" },
					guestCount: { type: "integer", example: 2 },
					unitPrice: { type: "number", example: 35 },
					priceUnit: { type: "string", enum: ["hour", "day"], example: "hour" },
					amount: { type: "number", example: 70 },
					status: { type: "string", enum: ["requested", "pending", "confirmed", "completed", "cancelled", "declined", "expired"] },
					paymentStatus: { type: "string", enum: ["not_required", "pending", "paid", "failed", "refund_pending", "refunded"] },
					expiresAt: { type: "string", format: "date-time", nullable: true },
					bookingCode: { type: "string", nullable: true, pattern: "^[A-Z0-9_-]{12}$", example: "A7Q9M2K4P6R8" },
					qrCode: { type: "string", format: "uri", nullable: true, description: "PNG data URL containing the bookingCode. Available on authorized single-booking reads; excluded from booking lists." },
					checkedInAt: { type: "string", format: "date-time", nullable: true, description: "Set once by the owning host's check-in request." },
					completedAt: { type: "string", format: "date-time", nullable: true },
					cancelledAt: { type: "string", format: "date-time", nullable: true },
					cancellationReason: { type: "string", nullable: true },
					createdAt: { type: "string", format: "date-time" },
					updatedAt: { type: "string", format: "date-time" },
					__v: { type: "integer", example: 0 },
				},
			},
			BookingResponse: {
				type: "object",
				properties: {
					success: { type: "boolean", example: true },
					message: { type: "string", enum: ["Booking cancelled; refund request is awaiting manual processing", "Booking cancelled; it is not eligible for a refund", "Booking cancelled successfully"], description: "Cancellation response; the value depends on refund eligibility and payment status." },
					data: { type: "object", properties: { booking: { $ref: "#/components/schemas/Booking" } } },
				},
			},
			BookingListResponse: {
				type: "object",
				properties: {
					success: { type: "boolean", example: true },
					data: { type: "object", properties: { bookings: { type: "array", items: { $ref: "#/components/schemas/Booking" } } } },
				},
			},
			MessageResponse: {
				type: "object",
				properties: { success: { type: "boolean", example: true }, message: { type: "string" } },
			},
			CreateReviewRequest: {
				type: "object",
				required: ["bookingId", "rating"],
				properties: {
					bookingId: { type: "string", example: "66d7f3c8a23b1e0012345678" },
					rating: { type: "integer", minimum: 1, maximum: 5, example: 5 },
					comment: { type: "string", example: "Great workspace and service." },
				},
			},
			Review: {
				type: "object",
				properties: {
					_id: { type: "string", example: "66d7f3c8a23b1e0012345678" },
					user: { oneOf: [{ type: "string" }, { type: "object", properties: { name: { type: "string" }, avatar: { type: "object", additionalProperties: true } } }] },
					workspace: { type: "string", example: "66d7f3c8a23b1e0012345678" },
					booking: { type: "string", example: "66d7f3c8a23b1e0012345678" },
					rating: { type: "integer", minimum: 1, maximum: 5, example: 5 },
					comment: { type: "string", example: "Great workspace and service." },
					createdAt: { type: "string", format: "date-time" },
					updatedAt: { type: "string", format: "date-time" },
				},
			},
			ReviewResponse: {
				type: "object",
				properties: {
					success: { type: "boolean", example: true },
					message: { type: "string", example: "Review submitted successfully" },
					data: { type: "object", properties: { review: { $ref: "#/components/schemas/Review" } } },
				},
			},
			ReviewListResponse: {
				type: "object",
				properties: {
					success: { type: "boolean", example: true },
					data: {
						type: "object",
						properties: {
							reviews: { type: "array", items: { $ref: "#/components/schemas/Review" } },
							pagination: {
								type: "object",
								properties: {
									page: { type: "integer", example: 1 },
									limit: { type: "integer", example: 20 },
									total: { type: "integer", example: 42 },
									totalPages: { type: "integer", example: 3 },
								},
							},
						},
					},
				},
			},
			DeleteReviewResponse: {
				type: "object",
				properties: {
					success: { type: "boolean", example: true },
					message: { type: "string", example: "Review deleted successfully" },
				},
			},
			Favourite: {
				type: "object",
				properties: {
					_id: { type: "string", example: "66d7f3c8a23b1e0012345678" },
					user: { type: "string", example: "66d7f3c8a23b1e0012345678" },
					workspace: { oneOf: [{ type: "string" }, { type: "object", additionalProperties: true }] },
					createdAt: { type: "string", format: "date-time" },
					updatedAt: { type: "string", format: "date-time" },
				},
			},
			FavouriteListResponse: {
				type: "object",
				properties: {
					success: { type: "boolean", example: true },
					count: { type: "integer", example: 2 },
					data: { type: "array", items: { $ref: "#/components/schemas/Favourite" } },
				},
			},
			FavouriteResponse: {
				type: "object",
				properties: {
					success: { type: "boolean", example: true },
					message: { type: "string", example: "Workspace added to favourites" },
					data: { $ref: "#/components/schemas/Favourite" },
				},
			},
			RemoveFavouriteResponse: {
				type: "object",
				properties: {
					success: { type: "boolean", example: true },
					message: { type: "string", example: "Favourite removed" },
				},
			},
			CreateAdminInvitationRequest: {
				type: "object",
				required: ["name", "email", "phone"],
				properties: {
					name: { type: "string", example: "Prince Ndu" },
					email: { type: "string", format: "email", example: "prince@example.com" },
					phone: { type: "string", example: "08031154652" },
				},
			},
			CompleteAdminInvitationRequest: {
				type: "object",
				required: ["token", "password"],
				properties: {
					token: { type: "string", example: "invitation-token" },
					password: { type: "string", format: "password", minLength: 8, example: "correct-horse-42" },
				},
			},
			AdminInvitationResponse: {
				type: "object",
				properties: {
					success: { type: "boolean", example: true },
					message: { type: "string", example: "Admin invitation sent successfully" },
					data: {
						type: "object",
						properties: {
							user: {
								type: "object",
								properties: {
									id: { type: "string", example: "66d7f3c8a23b1e0012345678" },
									name: { type: "string", example: "Prince Ndu" },
									email: { type: "string", format: "email", example: "prince@example.com" },
									role: { type: "string", example: "admin" },
								},
							},
							expiresAt: { type: "string", format: "date-time" },
						},
					},
				},
			},
			CompleteAdminInvitationResponse: {
				type: "object",
				properties: {
					success: { type: "boolean", example: true },
					message: { type: "string", example: "Admin account activated successfully" },
				},
			},
			ResendAdminInvitationResponse: {
				type: "object",
				properties: {
					success: { type: "boolean", example: true },
					message: { type: "string", example: "Admin invitation resent successfully" },
					data: { type: "object", properties: { expiresAt: { type: "string", format: "date-time" } } },
				},
			},
			AdminUserListResponse: {
				type: "object",
				properties: {
					success: { type: "boolean", example: true },
					data: {
						type: "object",
						properties: {
							users: { type: "array", items: { $ref: "#/components/schemas/User" } },
							pagination: {
								type: "object",
								properties: {
									page: { type: "integer", example: 1 },
									limit: { type: "integer", example: 20 },
									total: { type: "integer", example: 42 },
									pages: { type: "integer", example: 3 },
								},
							},
							filters: {
								type: "object",
								properties: {
									role: { type: "string", nullable: true },
									isActive: { type: "boolean", nullable: true },
									search: { type: "string", nullable: true },
									sortBy: { type: "string" },
									order: { type: "string", enum: ["asc", "desc"] },
								},
							},
						},
					},
				},
			},
			DeleteAdminResponse: {
				type: "object",
				properties: {
					success: { type: "boolean", example: true },
					message: { type: "string", example: "Admin user deleted successfully" },
				},
			},
			DeactivateUserResponse: {
				type: "object",
				properties: {
					success: { type: "boolean", example: true },
					message: { type: "string", enum: ["User deactivated successfully", "Admin user deactivated successfully"] },
					data: {
						type: "object",
						properties: {
							user: {
								type: "object",
								properties: {
									id: { type: "string", example: "66d7f3c8a23b1e0012345678" },
									role: { type: "string", enum: ["customer", "host", "admin"] },
									isActive: { type: "boolean", example: false },
								},
							},
						},
					},
				},
			},
		},
	},
};

router.use(authorizeDocs, swaggerUi.serve, swaggerUi.setup(swaggerDocument, {
	customSiteTitle: "Library Management System API Docs",
	swaggerOptions: { persistAuthorization: true },
}));

export default router;
