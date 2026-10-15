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
		description: "API reference for the endpoints currently registered by the Library Management System backend. Book endpoints are public; member endpoints require a staff bearer token.",
	},
	servers: [{ url: "/", description: "Current host" }],
	tags: [
		{ name: "Health", description: "Service availability" },
		{ name: "Authentication", description: "Sign in and retrieve the current user" },
		{ name: "Administration", description: "Admin-only staff account management" },
			{ name: "Members", description: "Staff-managed member records and borrowing history" },
		{ name: "Books", description: "Create, search, retrieve, update, and deactivate books" },
	],
	paths: {
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
				description: "Returns books newest first. Search is a case-insensitive literal partial match across title, author, bookCode, and ISBN. Category is a case-insensitive literal partial match. The page size is capped at 100.",
				operationId: "getBooks",
				parameters: [
					{ name: "search", in: "query", schema: { type: "string" }, description: "Case-insensitive partial search across title, author, bookCode, and isbn." },
					{ name: "category", in: "query", schema: { type: "string" }, description: "Case-insensitive literal partial match on category; regex characters are treated as plain text." },
					{ name: "isActive", in: "query", schema: { type: "string", enum: ["true", "false"] }, description: "Filter by active status. If supplied, only the literal strings true or false are accepted." },
					{ name: "page", in: "query", schema: { type: "integer", minimum: 1, default: 1 }, description: "One-based page number." },
					{ name: "limit", in: "query", schema: { type: "integer", minimum: 1, maximum: 100, default: 10 }, description: "Results per page." },
				],
				responses: {
					200: { description: "Books and pagination metadata.", content: { "application/json": { schema: { $ref: "#/components/schemas/BookListResponse" } } } },
					400: { description: "Invalid page, limit, or isActive query value.", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" }, examples: { pagination: { value: { success: false, error: { message: "Page must be a positive integer and limit must be between 1 and 100." } } }, isActive: { value: { success: false, error: { message: "isActive must be true or false." } } } } } } },
					500: { $ref: "#/components/responses/InternalServerError" },
				},
			},
			post: {
				tags: ["Books"],
				summary: "Create a book",
				description: "Creates a book. bookCode is generated by the server. If availableCopies is omitted, it is set to totalCopies. The model defaults isActive to true. Request properties not copied by the controller, including bookCode and isActive, have no effect.",
				operationId: "createBook",
				requestBody: {
					required: true,
					content: { "application/json": { schema: { $ref: "#/components/schemas/CreateBookRequest" }, example: { title: "The Left Hand of Darkness", author: "Ursula K. Le Guin", category: "Science Fiction", publisher: "Ace Books", isbn: "9780441478125", totalCopies: 4, description: "A science fiction novel." } } },
				},
				responses: {
					201: { description: "Book created.", content: { "application/json": { schema: { $ref: "#/components/schemas/BookResponse" } } } },
					400: { description: "Mongoose schema validation failed. The error.message contains the actual model validation details, including required fields, minimums, integer rules, or availableCopies exceeding totalCopies.", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" }, examples: { validation: { value: { success: false, error: { message: "Book validation failed: title: Path `title` is required." } } }, availableCopies: { value: { success: false, error: { message: "Book validation failed: availableCopies: Available copies cannot exceed total copies." } } } } } } },
					409: { $ref: "#/components/responses/DuplicateRecord" },
					500: { $ref: "#/components/responses/InternalServerError" },
				},
			},
		},
		"/api/books/{id}": {
			parameters: [{ $ref: "#/components/parameters/BookId" }],
			get: {
				tags: ["Books"],
				summary: "Get a book",
				operationId: "getBookById",
				responses: {
					200: { description: "The requested book.", content: { "application/json": { schema: { $ref: "#/components/schemas/BookResponse" } } } },
					400: { $ref: "#/components/responses/InvalidIdentifier" },
					404: { description: "No book exists with this ID.", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" }, example: { success: false, error: { message: "Book not found." } } } } },
					500: { $ref: "#/components/responses/InternalServerError" },
				},
			},
			patch: {
				tags: ["Books"],
				summary: "Update a book",
				description: "Updates only fields accepted by the controller. availableCopies is ignored because copy counts are managed by borrowing workflows. When totalCopies changes, availableCopies is recalculated as totalCopies minus the number of currently borrowed copies. bookCode is immutable and not accepted as an update.",
				operationId: "updateBook",
				requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/UpdateBookRequest" }, example: { title: "The Dispossessed", totalCopies: 6 } } } },
				responses: {
					200: { description: "The updated book.", content: { "application/json": { schema: { $ref: "#/components/schemas/BookResponse" } } } },
					400: { description: "Invalid identifier, totalCopies value, borrowed-copy constraint, or model validation.", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" }, examples: { invalidId: { value: { success: false, error: { message: "Invalid identifier" } } }, invalidTotal: { value: { success: false, error: { message: "totalCopies must be a non-negative whole number." } } }, belowBorrowed: { value: { success: false, error: { message: "Total copies cannot be less than the number of books currently borrowed." } } } } } } },
					404: { description: "No book exists with this ID.", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" }, example: { success: false, error: { message: "Book not found." } } } } },
					409: { $ref: "#/components/responses/DuplicateRecord" },
					500: { $ref: "#/components/responses/InternalServerError" },
				},
			},
		},
		"/api/books/{id}/deactivate": {
			parameters: [{ $ref: "#/components/parameters/BookId" }],
			patch: {
				tags: ["Books"],
				summary: "Deactivate a book",
				description: "Sets isActive to false. Deactivation is refused if any borrowing for the book has status borrowed.",
				operationId: "deactivateBook",
				responses: {
					200: { description: "Book deactivated.", content: { "application/json": { schema: { $ref: "#/components/schemas/BookMutationResponse" }, example: { success: true, message: "Book deactivated successfully.", data: { _id: "66d7f3c8a23b1e0012345678", title: "The Left Hand of Darkness", author: "Ursula K. Le Guin", category: "Science Fiction", bookCode: "BK-0123456789AB", totalCopies: 4, availableCopies: 4, isActive: false, createdAt: "2026-10-15T10:00:00.000Z", updatedAt: "2026-10-15T11:00:00.000Z", __v: 0 } } } } },
					400: { description: "Invalid identifier, book already inactive, or copies are currently borrowed.", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" }, examples: { invalidId: { value: { success: false, error: { message: "Invalid identifier" } } }, inactive: { value: { success: false, error: { message: "Book is already inactive." } } }, borrowed: { value: { success: false, error: { message: "This book cannot be deactivated while copies are still borrowed." } } } } } } },
					404: { description: "No book exists with this ID.", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" }, example: { success: false, error: { message: "Book not found." } } } } },
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
			BookId: { name: "id", in: "path", required: true, description: "MongoDB ObjectId of the book.", schema: { type: "string", pattern: "^[0-9a-fA-F]{24}$", example: "66d7f3c8a23b1e0012345678" } },
			MemberId: { name: "id", in: "path", required: true, description: "MongoDB ObjectId of the member.", schema: { type: "string", pattern: "^[0-9a-fA-F]{24}$", example: "66d7f3c8a23b1e0012345678" } },
			StaffId: { name: "id", in: "path", required: true, description: "MongoDB ObjectId of the staff user.", schema: { type: "string", pattern: "^[0-9a-fA-F]{24}$", example: "66d7f3c8a23b1e0012345678" } },
		},
		responses: {
			InvalidIdentifier: { description: "The ID could not be cast to a MongoDB ObjectId.", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" }, example: { success: false, error: { message: "Invalid identifier" } } } } },
			Forbidden: { description: "The authenticated staff role is not allowed to access this operation.", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" }, example: { success: false, error: { message: "You are not authorized to access this resource." } } } } },
			Unauthorized: { description: "The bearer token is missing, invalid, expired, or belongs to an inactive account.", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" }, examples: { missingToken: { value: { success: false, error: { message: "Authentication required." } } }, invalidToken: { value: { success: false, error: { message: "Invalid or expired token." } } }, inactiveAccount: { value: { success: false, error: { message: "Account is inactive." } } } } } } },
			DuplicateRecord: { description: "A unique field value, such as ISBN, already exists.", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" }, example: { success: false, error: { message: "That record already exists" } } } } },
			InternalServerError: { description: "Unexpected server error. The error handler hides the underlying error message.", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" }, example: { success: false, error: { message: "Internal server error" } } } } },
		},
		schemas: {
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
					_id: { type: "string", pattern: "^[0-9a-fA-F]{24}$", example: "66d7f3c8a23b1e0012345678" },
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
