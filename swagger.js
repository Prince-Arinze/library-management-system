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
		description: "API reference for the Library Management System. Book catalog reads are public; member, dashboard, report, and staff operations require an active staff bearer token.",
	},
	servers: [{ url: "/", description: "Library API (same host)" }],
	tags: [
		{ name: "Health", description: "Service availability" },
		{ name: "Authentication", description: "Sign in and retrieve the current user" },
		{ name: "Administration", description: "Admin-only staff account management" },
			{ name: "Members", description: "Staff-managed member records and borrowing history" },
		{ name: "Borrowings", description: "Staff-issued book borrowings" },
		{ name: "Books", description: "Create, search, retrieve, update, and deactivate books" },
		{ name: "Dashboard", description: "Staff-only library summary" },
		{ name: "Reports", description: "Staff-only inventory, borrowing, and member reports" },
	],
	paths: {
		"/api/dashboard/summary": {
			get: {
				tags: ["Dashboard"],
				summary: "Get dashboard summary",
				description: "Requires an active admin or librarian account.",
				operationId: "getDashboardSummary",
				security: [{ BearerAuth: [] }],
				responses: {
					200: {
						description: "Active book inventory, member totals, current borrowings, overdue borrowings, and generation time.",
						content: { "application/json": { schema: { $ref: "#/components/schemas/DashboardSummaryResponse" }, example: { success: true, data: { books: { activeTitles: 42, totalCopies: 80, availableCopies: 62 }, members: { total: 27, active: 24 }, borrowings: { current: 18, overdue: 3 }, generatedAt: "2026-10-16T12:00:00.000Z" } } } },
					},
					401: { $ref: "#/components/responses/Unauthorized" },
					403: { $ref: "#/components/responses/Forbidden" },
					500: { $ref: "#/components/responses/InternalServerError" },
				},
			},
		},
		"/api/reports/inventory": {
			get: {
				tags: ["Reports"],
				summary: "Get inventory report",
				description: "Requires an active admin or librarian account. Includes active book titles and copy totals.",
				operationId: "getInventoryReport",
				security: [{ BearerAuth: [] }],
				parameters: [{ $ref: "#/components/parameters/Page" }, { $ref: "#/components/parameters/Limit" }],
				responses: {
					200: { description: "Inventory summary, paginated books, and pagination metadata.", content: { "application/json": { schema: { $ref: "#/components/schemas/InventoryReportResponse" }, example: { success: true, data: { summary: { totalTitles: 42, totalCopies: 80, availableCopies: 62 }, books: [{ _id: "66d7f3c8a23b1e0012345678", title: "The Left Hand of Darkness", author: "Ursula K. Le Guin", category: "Science Fiction", bookCode: "BK-0123456789AB", totalCopies: 4, availableCopies: 3 }], pagination: { total: 42, page: 1, limit: 10, totalPages: 5 } } } } } },
					400: { description: "Invalid pagination values.", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" }, example: { success: false, error: { message: "limit cannot exceed 100." } } } } },
					401: { $ref: "#/components/responses/Unauthorized" },
					403: { $ref: "#/components/responses/Forbidden" },
					500: { $ref: "#/components/responses/InternalServerError" },
				},
			},
		},
		"/api/reports/overdue": {
			get: {
				tags: ["Reports"],
				summary: "Get overdue borrowing report",
				description: "Requires an active admin or librarian account. Lists unreturned borrowings whose due date has passed.",
				operationId: "getOverdueReport",
				security: [{ BearerAuth: [] }],
				parameters: [{ $ref: "#/components/parameters/Page" }, { $ref: "#/components/parameters/Limit" }],
				responses: {
					200: { description: "Overdue total, paginated borrowing records, and generation time.", content: { "application/json": { schema: { $ref: "#/components/schemas/OverdueReportResponse" }, example: { success: true, data: { totalOverdue: 1, borrowings: [{ _id: "66d7f3c8a23b1e0012345680", member: { _id: "66d7f3c8a23b1e0012345678", firstName: "Avery", lastName: "Morgan", membershipNumber: "LIB-2026-0001" }, book: { _id: "66d7f3c8a23b1e0012345679", title: "The Left Hand of Darkness", author: "Ursula K. Le Guin", bookCode: "BK-0123456789AB" }, issuedBy: { _id: "66d7f3c8a23b1e0012345677", name: "Library Staff", email: "staff@example.com" }, borrowedAt: "2026-10-01T12:00:00.000Z", dueDate: "2026-10-10T12:00:00.000Z", returnedAt: null, status: "borrowed", createdAt: "2026-10-01T12:00:00.000Z", updatedAt: "2026-10-01T12:00:00.000Z", __v: 0 }], pagination: { total: 1, page: 1, limit: 10, totalPages: 1 }, generatedAt: "2026-10-16T12:00:00.000Z" } } } } },
					400: { description: "Invalid pagination values.", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" }, example: { success: false, error: { message: "page must be a positive integer." } } } } },
					401: { $ref: "#/components/responses/Unauthorized" },
					403: { $ref: "#/components/responses/Forbidden" },
					500: { $ref: "#/components/responses/InternalServerError" },
				},
			},
		},
		"/api/reports/borrowings": {
			get: {
				tags: ["Reports"],
				summary: "Get borrowing history report",
				description: "Requires an active admin or librarian account. Optionally filter by borrowed or returned status.",
				operationId: "getBorrowingHistoryReport",
				security: [{ BearerAuth: [] }],
				parameters: [
					{ $ref: "#/components/parameters/Page" },
					{ $ref: "#/components/parameters/Limit" },
					{ name: "status", in: "query", schema: { type: "string", enum: ["borrowed", "returned"] } },
				],
				responses: {
					200: { description: "Total borrowing count, paginated borrowing records, and pagination metadata.", content: { "application/json": { schema: { $ref: "#/components/schemas/BorrowingHistoryReportResponse" }, example: { success: true, data: { total: 18, borrowings: [{ _id: "66d7f3c8a23b1e0012345680", member: { _id: "66d7f3c8a23b1e0012345678", firstName: "Avery", lastName: "Morgan", membershipNumber: "LIB-2026-0001" }, book: { _id: "66d7f3c8a23b1e0012345679", title: "The Left Hand of Darkness", author: "Ursula K. Le Guin", bookCode: "BK-0123456789AB" }, issuedBy: { _id: "66d7f3c8a23b1e0012345677", name: "Library Staff", email: "staff@example.com" }, borrowedAt: "2026-10-01T12:00:00.000Z", dueDate: "2026-10-20T12:00:00.000Z", returnedAt: null, status: "borrowed", createdAt: "2026-10-01T12:00:00.000Z", updatedAt: "2026-10-01T12:00:00.000Z", __v: 0 }], pagination: { total: 18, page: 1, limit: 10, totalPages: 2 } } } } } },
					400: { description: "Invalid pagination or status value.", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" }, examples: { invalidPagination: { value: { success: false, error: { message: "page must be a positive integer." } } }, invalidStatus: { value: { success: false, error: { message: "Status must be borrowed or returned." } } } } } } },
					401: { $ref: "#/components/responses/Unauthorized" },
					403: { $ref: "#/components/responses/Forbidden" },
					500: { $ref: "#/components/responses/InternalServerError" },
				},
			},
		},
		"/api/reports/members": {
			get: {
				tags: ["Reports"],
				summary: "Get member activity report",
				description: "Requires an active admin or librarian account. Includes borrowing activity for members on the requested page.",
				operationId: "getMemberActivityReport",
				security: [{ BearerAuth: [] }],
				parameters: [{ $ref: "#/components/parameters/Page" }, { $ref: "#/components/parameters/Limit" }],
				responses: {
					200: { description: "Member total, paginated member records with activity counts, and pagination metadata.", content: { "application/json": { schema: { $ref: "#/components/schemas/MemberActivityReportResponse" }, example: { success: true, data: { totalMembers: 27, members: [{ _id: "66d7f3c8a23b1e0012345678", firstName: "Avery", lastName: "Morgan", membershipNumber: "LIB-2026-0001", status: "active", registeredAt: "2026-09-15T12:00:00.000Z", activity: { totalBorrowings: 4, currentBorrowings: 1, returnedBorrowings: 3 } }], pagination: { total: 27, page: 1, limit: 10, totalPages: 3 } } } } } },
					400: { description: "Invalid pagination values.", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" }, example: { success: false, error: { message: "page must be a positive integer." } } } } },
					401: { $ref: "#/components/responses/Unauthorized" },
					403: { $ref: "#/components/responses/Forbidden" },
					500: { $ref: "#/components/responses/InternalServerError" },
				},
			},
		},
		"/api/reports/returns": {
			get: {
				tags: ["Reports"],
				summary: "Get returns report",
				description: "Requires an active admin or librarian account.",
				operationId: "getReturnsReport",
				security: [{ BearerAuth: [] }],
				parameters: [{ $ref: "#/components/parameters/Page" }, { $ref: "#/components/parameters/Limit" }],
				responses: {
					200: { description: "Return total, paginated returned-book records, pagination metadata, and generation time.", content: { "application/json": { schema: { $ref: "#/components/schemas/ReturnsReportResponse" }, example: { success: true, data: { totalReturns: 12, returns: [{ _id: "66d7f3c8a23b1e0012345680", member: { _id: "66d7f3c8a23b1e0012345678", firstName: "Avery", lastName: "Morgan", membershipNumber: "LIB-2026-0001" }, book: { _id: "66d7f3c8a23b1e0012345679", title: "The Left Hand of Darkness", author: "Ursula K. Le Guin", bookCode: "BK-0123456789AB" }, issuedBy: { _id: "66d7f3c8a23b1e0012345677", name: "Library Staff", email: "staff@example.com" }, borrowedAt: "2026-10-01T12:00:00.000Z", dueDate: "2026-10-10T12:00:00.000Z", returnedAt: "2026-10-09T12:00:00.000Z", status: "returned", createdAt: "2026-10-01T12:00:00.000Z", updatedAt: "2026-10-09T12:00:00.000Z", __v: 0 }], pagination: { total: 12, page: 1, limit: 10, totalPages: 2 }, generatedAt: "2026-10-16T12:00:00.000Z" } } } } },
					400: { description: "Invalid pagination values.", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" }, example: { success: false, error: { message: "limit cannot exceed 100." } } } } },
					401: { $ref: "#/components/responses/Unauthorized" },
					403: { $ref: "#/components/responses/Forbidden" },
					500: { $ref: "#/components/responses/InternalServerError" },
				},
			},
		},
		"/api/auth/login": {
			post: {
				tags: ["Authentication"],
				summary: "Sign in",
				operationId: "login",
				requestBody: {
					required: true,
					content: { "application/json": { schema: { $ref: "#/components/schemas/LoginRequest" }, example: { email: "librarian@example.com", password: "your-password" } } },
				},
				responses: {
					200: { description: "Signed in successfully.", content: { "application/json": { schema: { $ref: "#/components/schemas/AuthLoginResponse" } } } },
					400: { description: "Email or password is missing or invalid.", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" }, example: { success: false, error: { message: "Email and password are required." } } } } },
					401: { description: "Credentials are invalid or the account is inactive.", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" }, example: { success: false, error: { message: "Invalid email or password." } } } } },
					500: { $ref: "#/components/responses/InternalServerError" },
				},
			},
		},
		"/api/auth/me": {
			get: {
				tags: ["Authentication"],
				summary: "Get the current user",
				operationId: "getCurrentUser",
				security: [{ BearerAuth: [] }],
				responses: {
					200: { description: "The authenticated user.", content: { "application/json": { schema: { $ref: "#/components/schemas/AuthMeResponse" } } } },
					401: { $ref: "#/components/responses/Unauthorized" },
					500: { $ref: "#/components/responses/InternalServerError" },
				},
			},
		},
		"/users": {
			get: {
				tags: ["Administration"],
				summary: "List staff users",
				description: "Requires an active admin account.",
				operationId: "getUsers",
				security: [{ BearerAuth: [] }],
				responses: {
					200: { description: "Staff accounts, newest first.", content: { "application/json": { schema: { $ref: "#/components/schemas/AdminUserListResponse" } } } },
					401: { $ref: "#/components/responses/Unauthorized" },
					403: { $ref: "#/components/responses/Forbidden" },
					500: { $ref: "#/components/responses/InternalServerError" },
				},
			},
			post: {
				tags: ["Administration"],
				summary: "Create a staff user",
				description: "Requires an active admin account. Passwords must contain at least six characters; the default role is librarian.",
				operationId: "createUser",
				security: [{ BearerAuth: [] }],
				requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/CreateUserRequest" }, example: { name: "Library Staff", email: "staff@example.com", password: "secure-password", role: "librarian" } } } },
				responses: {
					201: { description: "Staff account created.", content: { "application/json": { schema: { $ref: "#/components/schemas/AdminUserResponse" } } } },
					400: { description: "Required fields, password, email, or role are invalid.", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" }, example: { success: false, error: { message: "Name, email, and password are required." } } } } },
					401: { $ref: "#/components/responses/Unauthorized" },
					403: { $ref: "#/components/responses/Forbidden" },
					409: { description: "Email already belongs to a staff account, including a concurrent duplicate create.", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" }, example: { success: false, error: { message: "Email already exists." } } } } },
					500: { $ref: "#/components/responses/InternalServerError" },
				},
			},
		},
		"/users/{id}": {
			parameters: [{ $ref: "#/components/parameters/StaffId" }],
			get: {
				tags: ["Administration"],
				summary: "Get a staff user",
				description: "Requires an active admin account.",
				operationId: "getUserById",
				security: [{ BearerAuth: [] }],
				responses: {
					200: { description: "The requested staff account.", content: { "application/json": { schema: { $ref: "#/components/schemas/AdminUserResponse" } } } },
					400: { $ref: "#/components/responses/InvalidIdentifier" },
					401: { $ref: "#/components/responses/Unauthorized" },
					403: { $ref: "#/components/responses/Forbidden" },
					404: { description: "Staff account not found.", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" }, example: { success: false, error: { message: "User not found." } } } } },
					500: { $ref: "#/components/responses/InternalServerError" },
				},
			},
			patch: {
				tags: ["Administration"],
				summary: "Update a staff user",
				description: "Requires an active admin account. The last active admin cannot be demoted or deactivated, and admins cannot demote or deactivate themselves.",
				operationId: "updateUser",
				security: [{ BearerAuth: [] }],
				requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/UpdateUserRequest" }, example: { name: "Senior Librarian", role: "librarian", isActive: true } } } },
				responses: {
					200: { description: "The updated staff account.", content: { "application/json": { schema: { $ref: "#/components/schemas/AdminUserResponse" } } } },
					400: { description: "Invalid user ID or fields, self-lockout attempt, or attempt to remove the last active admin.", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" }, example: { success: false, error: { message: "The last active administrator cannot be deactivated or demoted." } } } } },
					401: { $ref: "#/components/responses/Unauthorized" },
					403: { $ref: "#/components/responses/Forbidden" },
					404: { description: "Staff account not found.", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" }, example: { success: false, error: { message: "User not found." } } } } },
					500: { $ref: "#/components/responses/InternalServerError" },
				},
			},
		},
		"/users/{id}/deactivate": {
			parameters: [{ $ref: "#/components/parameters/StaffId" }],
			patch: {
				tags: ["Administration"],
				summary: "Deactivate a staff user",
				description: "Requires an active admin account. Admins cannot deactivate themselves or the last active admin.",
				operationId: "deactivateUser",
				security: [{ BearerAuth: [] }],
				responses: {
					200: { description: "Staff account deactivated.", content: { "application/json": { schema: { $ref: "#/components/schemas/AdminUserMutationResponse" } } } },
					400: { description: "Invalid user ID, self-deactivation, or last-admin removal is not allowed.", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
					401: { $ref: "#/components/responses/Unauthorized" },
					403: { $ref: "#/components/responses/Forbidden" },
					404: { description: "Staff account not found.", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" }, example: { success: false, error: { message: "User not found." } } } } },
					500: { $ref: "#/components/responses/InternalServerError" },
				},
			},
		},
		"/users/{id}/activate": {
			parameters: [{ $ref: "#/components/parameters/StaffId" }],
			patch: {
				tags: ["Administration"],
				summary: "Activate a staff user",
				description: "Requires an active admin account.",
				operationId: "activateUser",
				security: [{ BearerAuth: [] }],
				responses: {
					200: { description: "Staff account activated.", content: { "application/json": { schema: { $ref: "#/components/schemas/AdminUserMutationResponse" } } } },
					400: { $ref: "#/components/responses/InvalidIdentifier" },
					401: { $ref: "#/components/responses/Unauthorized" },
					403: { $ref: "#/components/responses/Forbidden" },
					404: { description: "Staff account not found.", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" }, example: { success: false, error: { message: "User not found." } } } } },
					500: { $ref: "#/components/responses/InternalServerError" },
				},
			},
		},
		"/api/members": {
			post: {
				tags: ["Members"],
				summary: "Register a member",
				description: "Requires an active admin or librarian account. The membership number is generated by the server.",
				operationId: "registerMember",
				security: [{ BearerAuth: [] }],
				requestBody: {
					required: true,
					content: { "application/json": { schema: { $ref: "#/components/schemas/CreateMemberRequest" }, example: { firstName: "Avery", lastName: "Morgan", email: "avery@example.com", phone: "555-0100", address: "12 Main Street" } } },
				},
				responses: {
					201: { description: "Member registered.", content: { "application/json": { schema: { $ref: "#/components/schemas/MemberResponse" } } } },
					400: { description: "Required names or member fields are invalid.", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" }, examples: { requiredNames: { value: { success: false, error: { message: "First name and last name are required." } } }, invalidEmail: { value: { success: false, error: { message: "Member validation failed: email: Email must be valid." } } } } } } },
					401: { $ref: "#/components/responses/Unauthorized" },
					403: { $ref: "#/components/responses/Forbidden" },
					409: { $ref: "#/components/responses/DuplicateRecord" },
					500: { $ref: "#/components/responses/InternalServerError" },
				},
			},
		},
		"/api/members/{id}": {
			parameters: [{ $ref: "#/components/parameters/MemberId" }],
			get: {
				tags: ["Members"],
				summary: "Get a member",
				description: "Requires an active admin or librarian account.",
				operationId: "getMember",
				security: [{ BearerAuth: [] }],
				responses: {
					200: { description: "The requested member.", content: { "application/json": { schema: { $ref: "#/components/schemas/MemberResponse" } } } },
					400: { $ref: "#/components/responses/InvalidIdentifier" },
					401: { $ref: "#/components/responses/Unauthorized" },
					403: { $ref: "#/components/responses/Forbidden" },
					404: { description: "No member exists with this ID.", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" }, example: { success: false, error: { message: "Member not found." } } } } },
					500: { $ref: "#/components/responses/InternalServerError" },
				},
			},
			patch: {
				tags: ["Members"],
				summary: "Update a member",
				description: "Requires an active admin or librarian account. Only firstName, lastName, email, phone, and address are updated.",
				operationId: "updateMember",
				security: [{ BearerAuth: [] }],
				requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/UpdateMemberRequest" }, example: { phone: "555-0101", address: "14 Main Street" } } } },
				responses: {
					200: { description: "The updated member.", content: { "application/json": { schema: { $ref: "#/components/schemas/MemberResponse" } } } },
					400: { description: "Invalid member ID, empty update, or invalid member fields.", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" }, examples: { emptyUpdate: { value: { success: false, error: { message: "Provide at least one member field to update." } } }, invalidEmail: { value: { success: false, error: { message: "Member validation failed: email: Email must be valid." } } } } } } },
					401: { $ref: "#/components/responses/Unauthorized" },
					403: { $ref: "#/components/responses/Forbidden" },
					404: { description: "No member exists with this ID.", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" }, example: { success: false, error: { message: "Member not found." } } } } },
					500: { $ref: "#/components/responses/InternalServerError" },
				},
			},
		},
		"/api/members/{id}/borrowings": {
			parameters: [{ $ref: "#/components/parameters/MemberId" }],
			get: {
				tags: ["Members"],
				summary: "List a member's borrowings",
				description: "Requires an active admin or librarian account. An empty borrowing history returns an empty data array.",
				operationId: "getMemberBorrowings",
				security: [{ BearerAuth: [] }],
				responses: {
					200: { description: "The member's borrowing history, newest first.", content: { "application/json": { schema: { $ref: "#/components/schemas/MemberBorrowingsResponse" } } } },
					400: { $ref: "#/components/responses/InvalidIdentifier" },
					401: { $ref: "#/components/responses/Unauthorized" },
					403: { $ref: "#/components/responses/Forbidden" },
					404: { description: "No member exists with this ID.", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" }, example: { success: false, error: { message: "Member not found." } } } } },
					500: { $ref: "#/components/responses/InternalServerError" },
				},
			},
		},
		"/api/members/{id}/deactivate": {
			parameters: [{ $ref: "#/components/parameters/MemberId" }],
			patch: {
				tags: ["Members"],
				summary: "Deactivate a member",
				description: "Requires an active admin account. The member record is retained so borrowing history remains intact.",
				operationId: "deactivateMember",
				security: [{ BearerAuth: [] }],
				responses: {
					200: { description: "Member deactivated.", content: { "application/json": { schema: { $ref: "#/components/schemas/MemberMutationResponse" } } } },
					400: { $ref: "#/components/responses/InvalidIdentifier" },
					401: { $ref: "#/components/responses/Unauthorized" },
					403: { $ref: "#/components/responses/Forbidden" },
					404: { description: "No member exists with this ID.", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" }, example: { success: false, error: { message: "Member not found." } } } } },
					500: { $ref: "#/components/responses/InternalServerError" },
				},
			},
		},
		"/api/borrowings": {
			post: {
				tags: ["Borrowings"],
				summary: "Issue a book to a member",
				description: "Requires an active admin or librarian account. The staff user's ID is recorded as issuedBy.",
				operationId: "issueBook",
				security: [{ BearerAuth: [] }],
				requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/IssueBookRequest" }, example: { memberId: "66d7f3c8a23b1e0012345676", bookId: "66d7f3c8a23b1e0012345678", dueDate: "2026-11-15T00:00:00.000Z" } } } },
				responses: {
					201: { description: "Borrowing created and available book count decremented. The returned book field contains the same MongoDB _id supplied as bookId.", content: { "application/json": { schema: { $ref: "#/components/schemas/BorrowingResponse" }, example: { success: true, data: { _id: "66d7f3c8a23b1e0012345680", member: "66d7f3c8a23b1e0012345676", book: "66d7f3c8a23b1e0012345678", issuedBy: "66d7f3c8a23b1e0012345677", borrowedAt: "2026-10-16T12:00:00.000Z", dueDate: "2026-11-15T00:00:00.000Z", returnedAt: null, status: "borrowed" } } } } },
					400: { description: "Required values, ID formats, due date, member status, or book availability are invalid.", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" }, examples: { required: { value: { success: false, error: { message: "memberId, bookId, and dueDate are required." } } }, invalidId: { value: { success: false, error: { message: "Invalid memberId or bookId format." } } }, futureDate: { value: { success: false, error: { message: "dueDate must be a future date." } } }, unavailable: { value: { success: false, error: { message: "No copies of this book are currently available." } } } } } } },
					401: { $ref: "#/components/responses/Unauthorized" },
					403: { $ref: "#/components/responses/Forbidden" },
					404: { description: "Member or book was not found.", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" }, example: { success: false, error: { message: "Member not found." } } } } },
					500: { $ref: "#/components/responses/InternalServerError" },
				},
			},
		},
		"/health": {
			get: {
				tags: ["Health"],
				summary: "Check service health",
				operationId: "getHealth",
				responses: {
					200: {
						description: "The API is responding.",
						content: { "application/json": { schema: { $ref: "#/components/schemas/HealthResponse" }, example: { success: true, data: { status: "ok" } } } },
					},
				},
			},
		},
		"/api/books": {
			get: {
				tags: ["Books"],
				summary: "List books",
				description: "Returns books newest first. Public requests see active books only; an active admin or librarian bearer token is required to list inactive books with isActive=false. Search is a case-insensitive literal partial match across title, author, bookCode, and ISBN. Category is a case-insensitive literal partial match. The page size is capped at 100.",
				operationId: "getBooks",
				security: [{}, { BearerAuth: [] }],
				parameters: [
					{ name: "search", in: "query", schema: { type: "string" }, description: "Case-insensitive partial search across title, author, bookCode, and isbn." },
					{ name: "category", in: "query", schema: { type: "string" }, description: "Case-insensitive literal partial match on category; regex characters are treated as plain text." },
					{ name: "isActive", in: "query", schema: { type: "string", enum: ["true", "false"] }, description: "Filter by active status. Public callers may request true; false requires an active admin or librarian token." },
					{ name: "page", in: "query", schema: { type: "integer", minimum: 1, default: 1 }, description: "One-based page number." },
					{ name: "limit", in: "query", schema: { type: "integer", minimum: 1, maximum: 100, default: 10 }, description: "Results per page." },
				],
				responses: {
					200: { description: "Books and pagination metadata.", content: { "application/json": { schema: { $ref: "#/components/schemas/BookListResponse" } } } },
					400: { description: "Invalid page, limit, or isActive query value.", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" }, examples: { pagination: { value: { success: false, error: { message: "Page must be a positive integer and limit must be between 1 and 100." } } }, isActive: { value: { success: false, error: { message: "isActive must be true or false." } } } } } } },
					401: { $ref: "#/components/responses/Unauthorized" },
					403: { $ref: "#/components/responses/Forbidden" },
					500: { $ref: "#/components/responses/InternalServerError" },
				},
			},
			post: {
				tags: ["Books"],
				summary: "Create a book",
				description: "Requires an active admin or librarian account. Creates a book. bookCode is generated by the server. If availableCopies is omitted, it is set to totalCopies. The model defaults isActive to true. Request properties not copied by the controller, including bookCode and isActive, have no effect.",
				operationId: "createBook",
				security: [{ BearerAuth: [] }],
				requestBody: {
					required: true,
					content: { "application/json": { schema: { $ref: "#/components/schemas/CreateBookRequest" }, example: { title: "The Left Hand of Darkness", author: "Ursula K. Le Guin", category: "Science Fiction", publisher: "Ace Books", isbn: "9780441478125", totalCopies: 4, description: "A science fiction novel." } } },
				},
				responses: {
					201: { description: "Book created.", content: { "application/json": { schema: { $ref: "#/components/schemas/BookResponse" } } } },
					400: { description: "Mongoose schema validation failed. The error.message contains the actual model validation details, including required fields, minimums, integer rules, or availableCopies exceeding totalCopies.", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" }, examples: { validation: { value: { success: false, error: { message: "Book validation failed: title: Path `title` is required." } } }, availableCopies: { value: { success: false, error: { message: "Book validation failed: availableCopies: Available copies cannot exceed total copies." } } } } } } },
					409: { $ref: "#/components/responses/DuplicateRecord" },
					401: { $ref: "#/components/responses/Unauthorized" },
					403: { $ref: "#/components/responses/Forbidden" },
					500: { $ref: "#/components/responses/InternalServerError" },
				},
			},
		},
		"/api/books/{id}": {
			parameters: [{ $ref: "#/components/parameters/BookId" }],
			get: {
				tags: ["Books"],
				summary: "Get a book",
				description: "Public requests can retrieve active books. An active admin or librarian bearer token is required to retrieve an inactive book.",
				operationId: "getBookById",
				security: [{}, { BearerAuth: [] }],
				responses: {
					200: { description: "The requested book.", content: { "application/json": { schema: { $ref: "#/components/schemas/BookResponse" } } } },
					400: { $ref: "#/components/responses/InvalidIdentifier" },
					401: { $ref: "#/components/responses/Unauthorized" },
					404: { description: "No visible book exists with this ID.", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" }, example: { success: false, error: { message: "Book not found." } } } } },
					500: { $ref: "#/components/responses/InternalServerError" },
				},
			},
			patch: {
				tags: ["Books"],
				summary: "Update a book",
				description: "Requires an active admin or librarian account. Updates only fields accepted by the controller. availableCopies is ignored because copy counts are managed by borrowing workflows. When totalCopies changes, availableCopies is recalculated as totalCopies minus the number of currently borrowed copies. bookCode is immutable and not accepted as an update.",
				operationId: "updateBook",
				security: [{ BearerAuth: [] }],
				requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/UpdateBookRequest" }, example: { title: "The Dispossessed", totalCopies: 6 } } } },
				responses: {
					200: { description: "The updated book.", content: { "application/json": { schema: { $ref: "#/components/schemas/BookResponse" } } } },
					400: { description: "Invalid identifier, totalCopies value, borrowed-copy constraint, or model validation.", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" }, examples: { invalidId: { value: { success: false, error: { message: "Invalid identifier" } } }, invalidTotal: { value: { success: false, error: { message: "totalCopies must be a non-negative whole number." } } }, belowBorrowed: { value: { success: false, error: { message: "Total copies cannot be less than the number of books currently borrowed." } } } } } } },
					404: { description: "No book exists with this ID.", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" }, example: { success: false, error: { message: "Book not found." } } } } },
					409: { $ref: "#/components/responses/DuplicateRecord" },
					401: { $ref: "#/components/responses/Unauthorized" },
					403: { $ref: "#/components/responses/Forbidden" },
					500: { $ref: "#/components/responses/InternalServerError" },
				},
			},
		},
		"/api/books/{id}/deactivate": {
			parameters: [{ $ref: "#/components/parameters/BookId" }],
			patch: {
				tags: ["Books"],
				summary: "Deactivate a book",
				description: "Requires an active admin or librarian account. Sets isActive to false. Deactivation is refused if any borrowing for the book has status borrowed.",
				operationId: "deactivateBook",
				security: [{ BearerAuth: [] }],
				responses: {
					200: { description: "Book deactivated.", content: { "application/json": { schema: { $ref: "#/components/schemas/BookMutationResponse" }, example: { success: true, message: "Book deactivated successfully.", data: { _id: "66d7f3c8a23b1e0012345678", title: "The Left Hand of Darkness", author: "Ursula K. Le Guin", category: "Science Fiction", bookCode: "BK-0123456789AB", totalCopies: 4, availableCopies: 4, isActive: false, createdAt: "2026-10-15T10:00:00.000Z", updatedAt: "2026-10-15T11:00:00.000Z", __v: 0 } } } } },
					400: { description: "Invalid identifier, book already inactive, or copies are currently borrowed.", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" }, examples: { invalidId: { value: { success: false, error: { message: "Invalid identifier" } } }, inactive: { value: { success: false, error: { message: "Book is already inactive." } } }, borrowed: { value: { success: false, error: { message: "This book cannot be deactivated while copies are still borrowed." } } } } } } },
					404: { description: "No book exists with this ID.", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" }, example: { success: false, error: { message: "Book not found." } } } } },
					401: { $ref: "#/components/responses/Unauthorized" },
					403: { $ref: "#/components/responses/Forbidden" },
					500: { $ref: "#/components/responses/InternalServerError" },
				},
			},
		},
	},
	components: {
		securitySchemes: {
			BearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" },
		},
		parameters: {
			BookId: { name: "id", in: "path", required: true, description: "The book's MongoDB _id, generated automatically and returned by the API. This is not the human-readable bookCode.", schema: { type: "string", pattern: "^[0-9a-fA-F]{24}$", example: "66d7f3c8a23b1e0012345678" } },
			MemberId: { name: "id", in: "path", required: true, description: "MongoDB ObjectId of the member.", schema: { type: "string", pattern: "^[0-9a-fA-F]{24}$", example: "66d7f3c8a23b1e0012345678" } },
			StaffId: { name: "id", in: "path", required: true, description: "MongoDB ObjectId of the staff user.", schema: { type: "string", pattern: "^[0-9a-fA-F]{24}$", example: "66d7f3c8a23b1e0012345678" } },
			Page: { name: "page", in: "query", description: "One-based page number.", schema: { type: "integer", minimum: 1, default: 1 } },
			Limit: { name: "limit", in: "query", description: "Results per page, up to 100.", schema: { type: "integer", minimum: 1, maximum: 100, default: 10 } },
		},
		responses: {
			InvalidIdentifier: { description: "The ID could not be cast to a MongoDB ObjectId.", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" }, example: { success: false, error: { message: "Invalid identifier" } } } } },
			Forbidden: { description: "The authenticated staff role is not allowed to access this operation.", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" }, example: { success: false, error: { message: "You are not authorized to access this resource." } } } } },
			Unauthorized: { description: "The bearer token is missing, invalid, expired, or belongs to an inactive account.", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" }, examples: { missingToken: { value: { success: false, error: { message: "Authentication required." } } }, invalidToken: { value: { success: false, error: { message: "Invalid or expired token." } } }, inactiveAccount: { value: { success: false, error: { message: "Account is inactive." } } } } } } },
			DuplicateRecord: { description: "A unique field value, such as ISBN, already exists.", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" }, example: { success: false, error: { message: "That record already exists" } } } } },
			InternalServerError: { description: "Unexpected server error. The error handler hides the underlying error message.", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" }, example: { success: false, error: { message: "Internal server error" } } } } },
		},
		schemas: {
			ReportPagination: {
				type: "object",
				required: ["total", "page", "limit", "totalPages"],
				properties: {
					total: { type: "integer", minimum: 0, example: 27 },
					page: { type: "integer", minimum: 1, example: 1 },
					limit: { type: "integer", minimum: 1, maximum: 100, example: 10 },
					totalPages: { type: "integer", minimum: 0, example: 3 },
				},
			},
			DashboardSummaryResponse: {
				type: "object",
				required: ["success", "data"],
				properties: {
					success: { type: "boolean", enum: [true] },
					data: {
						type: "object",
						required: ["books", "members", "borrowings", "generatedAt"],
						properties: {
							books: {
								type: "object",
								required: ["activeTitles", "totalCopies", "availableCopies"],
								properties: {
									activeTitles: { type: "integer", minimum: 0 },
									totalCopies: { type: "integer", minimum: 0 },
									availableCopies: { type: "integer", minimum: 0 },
								},
							},
							members: {
								type: "object",
								required: ["total", "active"],
								properties: {
									total: { type: "integer", minimum: 0 },
									active: { type: "integer", minimum: 0 },
								},
							},
							borrowings: {
								type: "object",
								required: ["current", "overdue"],
								properties: {
									current: { type: "integer", minimum: 0 },
									overdue: { type: "integer", minimum: 0 },
								},
							},
							generatedAt: { type: "string", format: "date-time" },
						},
					},
				},
			},
			InventoryReportBook: {
				type: "object",
				required: ["_id", "title", "author", "category", "bookCode", "totalCopies", "availableCopies"],
				properties: {
					_id: { type: "string", pattern: "^[0-9a-fA-F]{24}$" },
					title: { type: "string" },
					author: { type: "string" },
					category: { type: "string" },
					bookCode: { type: "string" },
					totalCopies: { type: "integer", minimum: 0 },
					availableCopies: { type: "integer", minimum: 0 },
				},
			},
			InventoryReportResponse: {
				type: "object",
				required: ["success", "data"],
				properties: {
					success: { type: "boolean", enum: [true] },
					data: {
						type: "object",
						required: ["summary", "books", "pagination"],
						properties: {
							summary: {
								type: "object",
								required: ["totalTitles", "totalCopies", "availableCopies"],
								properties: {
									totalTitles: { type: "integer", minimum: 0 },
									totalCopies: { type: "integer", minimum: 0 },
									availableCopies: { type: "integer", minimum: 0 },
								},
							},
							books: { type: "array", items: { $ref: "#/components/schemas/InventoryReportBook" } },
							pagination: { $ref: "#/components/schemas/ReportPagination" },
						},
					},
				},
			},
			ReportMemberReference: {
				type: "object",
				required: ["_id", "firstName", "lastName", "membershipNumber"],
				properties: {
					_id: { type: "string", pattern: "^[0-9a-fA-F]{24}$" },
					firstName: { type: "string" },
					lastName: { type: "string" },
					membershipNumber: { type: "string" },
				},
			},
			ReportBookReference: {
				type: "object",
				required: ["_id", "title", "author", "bookCode"],
				properties: {
					_id: { type: "string", pattern: "^[0-9a-fA-F]{24}$" },
					title: { type: "string" },
					author: { type: "string" },
					bookCode: { type: "string" },
				},
			},
			ReportStaffReference: {
				type: "object",
				required: ["_id", "name", "email"],
				properties: {
					_id: { type: "string", pattern: "^[0-9a-fA-F]{24}$" },
					name: { type: "string" },
					email: { type: "string", format: "email" },
				},
			},
			ReportBorrowing: {
				type: "object",
				required: ["_id", "member", "book", "issuedBy", "borrowedAt", "dueDate", "returnedAt", "status", "createdAt", "updatedAt", "__v"],
				properties: {
					_id: { type: "string", pattern: "^[0-9a-fA-F]{24}$" },
					member: { type: "object", nullable: true, allOf: [{ $ref: "#/components/schemas/ReportMemberReference" }] },
					book: { type: "object", nullable: true, allOf: [{ $ref: "#/components/schemas/ReportBookReference" }] },
					issuedBy: { type: "object", nullable: true, allOf: [{ $ref: "#/components/schemas/ReportStaffReference" }] },
					borrowedAt: { type: "string", format: "date-time" },
					dueDate: { type: "string", format: "date-time" },
					returnedAt: { type: "string", format: "date-time", nullable: true },
					status: { type: "string", enum: ["borrowed", "returned"] },
					createdAt: { type: "string", format: "date-time" },
					updatedAt: { type: "string", format: "date-time" },
					__v: { type: "integer", minimum: 0 },
				},
			},
			OverdueReportResponse: {
				type: "object",
				required: ["success", "data"],
				properties: {
					success: { type: "boolean", enum: [true] },
					data: {
						type: "object",
						required: ["totalOverdue", "borrowings", "pagination", "generatedAt"],
						properties: {
							totalOverdue: { type: "integer", minimum: 0 },
							borrowings: { type: "array", items: { $ref: "#/components/schemas/ReportBorrowing" } },
							pagination: { $ref: "#/components/schemas/ReportPagination" },
							generatedAt: { type: "string", format: "date-time" },
						},
					},
				},
			},
			BorrowingHistoryReportResponse: {
				type: "object",
				required: ["success", "data"],
				properties: {
					success: { type: "boolean", enum: [true] },
					data: {
						type: "object",
						required: ["total", "borrowings", "pagination"],
						properties: {
							total: { type: "integer", minimum: 0 },
							borrowings: { type: "array", items: { $ref: "#/components/schemas/ReportBorrowing" } },
							pagination: { $ref: "#/components/schemas/ReportPagination" },
						},
					},
				},
			},
			MemberActivityReportMember: {
				type: "object",
				required: ["_id", "firstName", "lastName", "membershipNumber", "status", "registeredAt", "activity"],
				properties: {
					_id: { type: "string", pattern: "^[0-9a-fA-F]{24}$" },
					firstName: { type: "string" },
					lastName: { type: "string" },
					membershipNumber: { type: "string" },
					status: { type: "string", enum: ["active", "inactive"] },
					registeredAt: { type: "string", format: "date-time" },
					activity: {
						type: "object",
						required: ["totalBorrowings", "currentBorrowings", "returnedBorrowings"],
						properties: {
							totalBorrowings: { type: "integer", minimum: 0 },
							currentBorrowings: { type: "integer", minimum: 0 },
							returnedBorrowings: { type: "integer", minimum: 0 },
						},
					},
				},
			},
			MemberActivityReportResponse: {
				type: "object",
				required: ["success", "data"],
				properties: {
					success: { type: "boolean", enum: [true] },
					data: {
						type: "object",
						required: ["totalMembers", "members", "pagination"],
						properties: {
							totalMembers: { type: "integer", minimum: 0 },
							members: { type: "array", items: { $ref: "#/components/schemas/MemberActivityReportMember" } },
							pagination: { $ref: "#/components/schemas/ReportPagination" },
						},
					},
				},
			},
			ReturnsReportResponse: {
				type: "object",
				required: ["success", "data"],
				properties: {
					success: { type: "boolean", enum: [true] },
					data: {
						type: "object",
						required: ["totalReturns", "returns", "pagination", "generatedAt"],
						properties: {
							totalReturns: { type: "integer", minimum: 0 },
							returns: { type: "array", items: { $ref: "#/components/schemas/ReportBorrowing" } },
							pagination: { $ref: "#/components/schemas/ReportPagination" },
							generatedAt: { type: "string", format: "date-time" },
						},
					},
				},
			},
			IssueBookRequest: {
				type: "object",
				required: ["memberId", "bookId", "dueDate"],
				properties: {
					memberId: { type: "string", pattern: "^[0-9a-fA-F]{24}$", example: "66d7f3c8a23b1e0012345676" },
					bookId: { type: "string", pattern: "^[0-9a-fA-F]{24}$", example: "66d7f3c8a23b1e0012345678", description: "The book's MongoDB _id, generated automatically when the book is created. Use the 24-character hexadecimal _id returned by the API, not the human-readable bookCode." },
					dueDate: { type: "string", format: "date-time" },
				},
			},
			Borrowing: {
				type: "object",
				required: ["_id", "member", "book", "issuedBy", "borrowedAt", "dueDate", "returnedAt", "status"],
				properties: {
					_id: { type: "string", pattern: "^[0-9a-fA-F]{24}$" },
					member: { type: "string", pattern: "^[0-9a-fA-F]{24}$" },
					book: { type: "string", pattern: "^[0-9a-fA-F]{24}$", description: "MongoDB _id of the book; this is the same value supplied as bookId when issuing it." },
					issuedBy: { type: "string", pattern: "^[0-9a-fA-F]{24}$", description: "Authenticated staff user who issued the book." },
					borrowedAt: { type: "string", format: "date-time" },
					dueDate: { type: "string", format: "date-time" },
					returnedAt: { type: "string", format: "date-time", nullable: true },
					status: { type: "string", enum: ["borrowed", "returned"] },
				},
			},
			BorrowingResponse: {
				type: "object",
				required: ["success", "data"],
				properties: { success: { type: "boolean", example: true }, data: { $ref: "#/components/schemas/Borrowing" } },
			},
			CreateUserRequest: {
				type: "object",
				required: ["name", "email", "password"],
				properties: {
					name: { type: "string", minLength: 1, example: "Library Staff" },
					email: { type: "string", format: "email", example: "staff@example.com" },
					password: { type: "string", format: "password", minLength: 6 },
					role: { type: "string", enum: ["admin", "librarian"], default: "librarian" },
				},
			},
			UpdateUserRequest: {
				type: "object",
				minProperties: 1,
				properties: {
					name: { type: "string", minLength: 1 },
					role: { type: "string", enum: ["admin", "librarian"] },
					isActive: { type: "boolean" },
				},
			},
			AdminUser: {
				type: "object",
				required: ["id", "name", "email", "role", "isActive"],
				properties: {
					id: { type: "string", pattern: "^[0-9a-fA-F]{24}$" },
					name: { type: "string", example: "Library Staff" },
					email: { type: "string", format: "email", example: "staff@example.com" },
					role: { type: "string", enum: ["admin", "librarian"] },
					isActive: { type: "boolean", example: true },
				},
			},
			AdminUserResponse: {
				type: "object",
				required: ["success", "data"],
				properties: { success: { type: "boolean", example: true }, data: { $ref: "#/components/schemas/AdminUser" } },
			},
			AdminUserListResponse: {
				type: "object",
				required: ["success", "count", "data"],
				properties: {
					success: { type: "boolean", example: true },
					count: { type: "integer", example: 2 },
					data: { type: "array", items: { $ref: "#/components/schemas/AdminUser" } },
				},
			},
			AdminUserMutationResponse: {
				type: "object",
				required: ["success", "message", "data"],
				properties: {
					success: { type: "boolean", example: true },
					message: { type: "string", enum: ["User activated successfully.", "User deactivated successfully."] },
					data: { $ref: "#/components/schemas/AdminUser" },
				},
			},
			CreateMemberRequest: {
				type: "object",
				required: ["firstName", "lastName"],
				properties: {
					firstName: { type: "string", minLength: 1, example: "Avery" },
					lastName: { type: "string", minLength: 1, example: "Morgan" },
					email: { type: "string", format: "email", example: "avery@example.com" },
					phone: { type: "string", example: "555-0100" },
					address: { type: "string", example: "12 Main Street" },
				},
			},
			UpdateMemberRequest: {
				type: "object",
				minProperties: 1,
				properties: {
					firstName: { type: "string", minLength: 1 },
					lastName: { type: "string", minLength: 1 },
					email: { type: "string", format: "email" },
					phone: { type: "string" },
					address: { type: "string" },
				},
			},
			Member: {
				type: "object",
				required: ["_id", "firstName", "lastName", "membershipNumber", "status", "registeredAt"],
				properties: {
					_id: { type: "string", pattern: "^[0-9a-fA-F]{24}$", example: "66d7f3c8a23b1e0012345678", description: "Generated automatically by MongoDB when the book is created; use this value as bookId in borrowing requests." },
					firstName: { type: "string", example: "Avery" },
					lastName: { type: "string", example: "Morgan" },
					email: { type: "string", format: "email" },
					phone: { type: "string" },
					address: { type: "string" },
					membershipNumber: { type: "string", readOnly: true, pattern: "^LIB-[0-9]{4}-[0-9]+$", example: "LIB-2026-0001" },
					status: { type: "string", enum: ["active", "inactive"], example: "active" },
					registeredAt: { type: "string", format: "date-time" },
					createdAt: { type: "string", format: "date-time" },
					updatedAt: { type: "string", format: "date-time" },
				},
			},
			MemberResponse: {
				type: "object",
				required: ["success", "data"],
				properties: { success: { type: "boolean", example: true }, data: { $ref: "#/components/schemas/Member" } },
			},
			MemberMutationResponse: {
				type: "object",
				required: ["success", "message", "data"],
				properties: { success: { type: "boolean", example: true }, message: { type: "string", example: "Member deactivated successfully." }, data: { $ref: "#/components/schemas/Member" } },
			},
			MemberBorrowingsResponse: {
				type: "object",
				required: ["success", "count", "data"],
				properties: {
					success: { type: "boolean", example: true },
					count: { type: "integer", example: 1 },
					data: { type: "array", items: { $ref: "#/components/schemas/MemberBorrowing" } },
				},
			},
			MemberBorrowing: {
				type: "object",
				required: ["_id", "member", "book", "issuedBy", "borrowedAt", "dueDate", "status"],
				properties: {
					_id: { type: "string", pattern: "^[0-9a-fA-F]{24}$" },
					member: { type: "string", pattern: "^[0-9a-fA-F]{24}$" },
					book: { type: "object", required: ["_id", "title", "author"], properties: { _id: { type: "string" }, title: { type: "string" }, author: { type: "string" } } },
					issuedBy: { type: "string", pattern: "^[0-9a-fA-F]{24}$" },
					borrowedAt: { type: "string", format: "date-time" },
					dueDate: { type: "string", format: "date-time" },
					returnedAt: { type: "string", format: "date-time", nullable: true },
					status: { type: "string", enum: ["borrowed", "returned"] },
				},
			},
			LoginRequest: {
				type: "object",
				required: ["email", "password"],
				properties: {
					email: { type: "string", format: "email", example: "librarian@example.com" },
					password: { type: "string", format: "password", example: "your-password" },
				},
			},
			AuthUser: {
				type: "object",
				required: ["id", "name", "email", "role", "isActive"],
				properties: {
					id: { type: "string", example: "66d7f3c8a23b1e0012345678" },
					name: { type: "string", example: "Library Staff" },
					email: { type: "string", format: "email", example: "librarian@example.com" },
					role: { type: "string", enum: ["admin", "librarian"] },
					isActive: { type: "boolean", example: true },
				},
			},
			AuthLoginResponse: {
				type: "object",
				required: ["success", "data"],
				properties: {
					success: { type: "boolean", example: true },
					data: { type: "object", required: ["token", "user"], properties: { token: { type: "string", description: "JWT bearer token." }, user: { $ref: "#/components/schemas/AuthUser" } } },
				},
			},
			AuthMeResponse: {
				type: "object",
				required: ["success", "data"],
				properties: {
					success: { type: "boolean", example: true },
					data: { type: "object", required: ["user"], properties: { user: { $ref: "#/components/schemas/AuthUser" } } },
				},
			},
			HealthResponse: {
				type: "object",
				required: ["success", "data"],
				properties: { success: { type: "boolean", example: true }, data: { type: "object", required: ["status"], properties: { status: { type: "string", enum: ["ok"], example: "ok" } } } },
			},
			Book: {
				type: "object",
				required: ["_id", "title", "author", "category", "bookCode", "totalCopies", "availableCopies", "isActive", "createdAt", "updatedAt", "__v"],
				properties: {
					_id: { type: "string", pattern: "^[0-9a-fA-F]{24}$", example: "66d7f3c8a23b1e0012345678" },
					title: { type: "string", example: "The Left Hand of Darkness" },
					author: { type: "string", example: "Ursula K. Le Guin" },
					category: { type: "string", example: "Science Fiction" },
					publisher: { type: "string", description: "Omitted when not set.", example: "Ace Books" },
					isbn: { type: "string", description: "Unique when supplied; the database index is sparse.", example: "9780441478125" },
					bookCode: { type: "string", readOnly: true, pattern: "^BK-[A-F0-9]{12}$", example: "BK-0123456789AB", description: "Generated on the server when the book is created." },
					totalCopies: { type: "integer", minimum: 0, example: 4 },
					availableCopies: { type: "integer", minimum: 0, example: 4 },
					description: { type: "string", description: "Omitted when not set." },
					isActive: { type: "boolean", default: true, example: true },
					createdAt: { type: "string", format: "date-time" },
					updatedAt: { type: "string", format: "date-time" },
					__v: { type: "integer", description: "Mongoose version key." },
				},
			},
			CreateBookRequest: {
				type: "object",
				required: ["title", "author", "category", "totalCopies"],
				properties: {
					title: { type: "string", example: "The Left Hand of Darkness" },
					author: { type: "string", example: "Ursula K. Le Guin" },
					category: { type: "string", example: "Science Fiction" },
					publisher: { type: "string" },
					isbn: { type: "string", description: "Unique if supplied; duplicate values produce HTTP 409." },
					totalCopies: { type: "integer", minimum: 0, description: "Required; must be a whole number." },
					availableCopies: { type: "integer", minimum: 0, description: "Optional; defaults to totalCopies and cannot exceed it." },
					description: { type: "string" },
				},
			},
			UpdateBookRequest: {
				type: "object",
				description: "All properties are optional. Unknown properties are ignored by the controller.",
				properties: {
					title: { type: "string" },
					author: { type: "string" },
					category: { type: "string" },
					publisher: { type: "string" },
					isbn: { type: "string", description: "Unique if supplied; duplicate values produce HTTP 409." },
					totalCopies: { type: "integer", minimum: 0, description: "Must be a whole number and cannot be less than the number of active borrowings." },
					availableCopies: { type: "integer", description: "Accepted but ignored; this field is recalculated when totalCopies changes." },
					description: { type: "string" },
				},
			},
			BookResponse: {
				type: "object",
				required: ["success", "data"],
				properties: { success: { type: "boolean", example: true }, data: { $ref: "#/components/schemas/Book" } },
			},
			BookMutationResponse: {
				type: "object",
				required: ["success", "message", "data"],
				properties: { success: { type: "boolean", example: true }, message: { type: "string", enum: ["Book deactivated successfully."] }, data: { $ref: "#/components/schemas/Book" } },
			},
			BookListResponse: {
				type: "object",
				required: ["success", "data", "pagination"],
				properties: {
					success: { type: "boolean", example: true },
					data: { type: "array", items: { $ref: "#/components/schemas/Book" } },
					pagination: { type: "object", required: ["total", "page", "limit", "totalPages"], properties: { total: { type: "integer", example: 25 }, page: { type: "integer", example: 1 }, limit: { type: "integer", example: 10 }, totalPages: { type: "integer", example: 3 } } },
				},
			},
			ErrorResponse: {
				type: "object",
				required: ["success", "error"],
				properties: { success: { type: "boolean", enum: [false] }, error: { type: "object", required: ["message"], properties: { message: { type: "string" } } } },
			},
		},
	},
};

router.use(authorizeDocs, swaggerUi.serve, swaggerUi.setup(swaggerDocument, {
	customSiteTitle: "Library Management System API Docs",
	swaggerOptions: { persistAuthorization: true },
}));

export default router;
export { swaggerDocument };
