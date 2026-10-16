import { EXTERNAL_URLS } from '../consts';
import { t } from '../i18n';
import { safeStringify } from '../json';

/** Hostnames that are official DeepSeek endpoints (used to gate the create-key link). */
const OFFICIAL_API_HOSTS = ['api.deepseek.com'];

/** Maximum length for a single diagnostic field before truncation. */
const MAX_DIAGNOSTIC_FIELD_LENGTH = 300;

/** VS Code command URI that opens the API-key prompt. */
const SET_API_KEY_COMMAND = 'command:deepseek-copilot.setApiKey';

/** VS Code command URI that reveals the extension log output. */
const SHOW_LOGS_COMMAND = 'command:deepseek-copilot.showLogs';

type RequestErrorKind = 'http' | 'network' | 'unknown';

interface DeepSeekRequestErrorOptions {
	message: string;
	kind: RequestErrorKind;
	baseUrl: string;
	userSummary?: string;
	diagnosticMessage?: string;
	status?: number;
	code?: string;
	cause?: unknown;
}

interface ErrorAction {
	labelKey: string;
	url: string;
}

/**
 * Maps Node/undici network error codes to a user-facing category.
 * Same table as the GLM extension since both speak the same Node fetch.
 */
const NETWORK_ERROR_CATEGORY_BY_CODE: Record<string, NetworkErrorCategory> = {
	ENOTFOUND: 'dns',
	EAI_AGAIN: 'dns',
	ENODATA: 'dns',
	ESERVFAIL: 'dns',
	EFORMERR: 'dns',
	ENONAME: 'dns',
	EBADNAME: 'dns',
	EBADQUERY: 'dns',
	EBADFAMILY: 'dns',
	EBADRESP: 'dns',
	ENOTIMP: 'dns',
	EREFUSED: 'dns',
	ENOTINITIALIZED: 'dns',
	ELOADIPHLPAPI: 'dns',
	EADDRGETNETWORKPARAMS: 'dns',
	ECONNREFUSED: 'unreachable',
	ENETUNREACH: 'unreachable',
	EHOSTUNREACH: 'unreachable',
	EADDRNOTAVAIL: 'unreachable',
	ENETDOWN: 'unreachable',
	EHOSTDOWN: 'unreachable',
	ECONNRESET: 'interrupted',
	ECONNABORTED: 'interrupted',
	ENETRESET: 'interrupted',
	ENOTCONN: 'interrupted',
	EPIPE: 'interrupted',
	EOF: 'interrupted',
	UND_ERR_SOCKET: 'interrupted',
	SocketError: 'interrupted',
	ETIMEDOUT: 'timeout',
	ETIMEOUT: 'timeout',
	ESOCKETTIMEDOUT: 'timeout',
	UND_ERR_CONNECT_TIMEOUT: 'timeout',
	UND_ERR_HEADERS_TIMEOUT: 'timeout',
	UND_ERR_BODY_TIMEOUT: 'timeout',
	ERR_TLS_HANDSHAKE_TIMEOUT: 'timeout',
	TimeoutError: 'timeout',
	ConnectTimeoutError: 'timeout',
	HeadersTimeoutError: 'timeout',
	BodyTimeoutError: 'timeout',
	CERT_HAS_EXPIRED: 'tls',
	CERT_NOT_YET_VALID: 'tls',
	CERT_UNTRUSTED: 'tls',
	CERT_REJECTED: 'tls',
	CERT_SIGNATURE_FAILURE: 'tls',
	SELF_SIGNED_CERT_IN_CHAIN: 'tls',
	DEPTH_ZERO_SELF_SIGNED_CERT: 'tls',
	UNABLE_TO_VERIFY_LEAF_SIGNATURE: 'tls',
	UNABLE_TO_GET_ISSUER_CERT_LOCALLY: 'tls',
	UNABLE_TO_GET_ISSUER_CERT: 'tls',
	UNABLE_TO_GET_CRL: 'tls',
	UNABLE_TO_DECRYPT_CERT_SIGNATURE: 'tls',
	UNABLE_TO_DECRYPT_CRL_SIGNATURE: 'tls',
	UNABLE_TO_DECODE_ISSUER_PUBLIC_KEY: 'tls',
	CRL_SIGNATURE_FAILURE: 'tls',
	ERR_TLS_CERT_ALTNAME_INVALID: 'tls',
	UND_ERR_PRX_TLS: 'tls',
	SecureProxyConnectionError: 'tls',
	ABORT_ERR: 'aborted',
	AbortError: 'aborted',
	UND_ERR_ABORTED: 'aborted',
	ECANCELLED: 'aborted',
	UND_ERR_HEADERS_OVERFLOW: 'protocol',
	UND_ERR_RESPONSE: 'protocol',
	UND_ERR_REQ_CONTENT_LENGTH_MISMATCH: 'protocol',
	UND_ERR_RES_CONTENT_LENGTH_MISMATCH: 'protocol',
	UND_ERR_RES_EXCEEDED_MAX_SIZE: 'protocol',
	HTTPParserError: 'protocol',
	HeadersOverflowError: 'protocol',
	ResponseError: 'protocol',
	ResponseContentLengthMismatchError: 'protocol',
	ResponseExceededMaxSizeError: 'protocol',
	ERR_INVALID_URL: 'configuration',
	ERR_INVALID_ARG_TYPE: 'configuration',
	ERR_INVALID_ARG_VALUE: 'configuration',
	UND_ERR_INVALID_ARG: 'configuration',
	InvalidArgumentError: 'configuration',
};

type NetworkErrorCategory =
	| 'dns'
	| 'unreachable'
	| 'interrupted'
	| 'timeout'
	| 'tls'
	| 'aborted'
	| 'protocol'
	| 'configuration'
	| 'generic';

interface NetworkCauseInfo {
	code?: string;
	name?: string;
	message?: string;
	value: string;
}

/** A DeepSeek request failure carrying both a user-facing summary and diagnostics. */
export class DeepSeekRequestError extends Error {
	readonly kind: RequestErrorKind;
	readonly userSummary: string;
	readonly diagnosticMessage: string;
	readonly baseUrl: string;
	readonly status?: number;
	readonly code?: string;

	constructor(options: DeepSeekRequestErrorOptions) {
		super(options.message, { cause: options.cause });
		this.name = 'DeepSeekRequestError';
		this.kind = options.kind;
		this.userSummary = options.userSummary ?? options.message;
		this.diagnosticMessage = options.diagnosticMessage ?? options.message;
		this.baseUrl = options.baseUrl;
		this.status = options.status;
		this.code = options.code;
	}
}

export function isAbortError(error: unknown): boolean {
	return error instanceof Error && error.name === 'AbortError';
}

/** Build a `DeepSeekRequestError` from a non-OK HTTP response. */
export async function createHttpError(
	response: Response,
	context: { baseUrl: string },
): Promise<DeepSeekRequestError> {
	const { baseUrl } = context;
	const responseText = await response.text();
	const serverMessage = extractServerMessage(responseText);
	const statusLabel = `HTTP ${response.status}`;
	const userSummary = getHttpErrorMessage(response.status, statusLabel, baseUrl);
	return new DeepSeekRequestError({
		message: `DeepSeek API request failed with HTTP ${response.status}`,
		userSummary,
		kind: 'http',
		baseUrl,
		status: response.status,
		code: `HTTP_${response.status}`,
		diagnosticMessage: joinDiagnosticParts(
			'kind=http',
			`status=${response.status}`,
			`baseUrl=${safeStringify(baseUrl)}`,
			`statusText=${safeStringify(response.statusText || 'unknown')}`,
			serverMessage ? `serverMessage=${safeStringify(serverMessage)}` : undefined,
			responseText && responseText !== serverMessage
				? `body=${safeStringify(truncateSingleLine(responseText))}`
				: undefined,
		),
	});
}

/** Categorize a thrown value into a `DeepSeekRequestError`, or return it unchanged. */
export function normalizeRequestError(
	error: unknown,
	context: { baseUrl: string },
): DeepSeekRequestError | Error {
	if (error instanceof DeepSeekRequestError) {
		return error;
	}
	if (error instanceof Error) {
		if (isAbortError(error)) {
			return error;
		}
		const code = getNetworkErrorCode(error);
		const category = getNetworkErrorCategory(code);
		const baseUrl = context.baseUrl;
		const userSummary =
			category === 'generic'
				? t('error.unknown', error.message || error.name)
				: t(`error.network.${category}`, code ?? 'UNKNOWN');
		return new DeepSeekRequestError({
			message: error.message,
			kind: 'network',
			baseUrl,
			code: code ?? error.name,
			userSummary,
			diagnosticMessage: joinDiagnosticParts(
				'kind=network',
				`category=${category}`,
				`code=${safeStringify(code ?? error.name)}`,
				`baseUrl=${safeStringify(baseUrl)}`,
				`name=${safeStringify(error.name)}`,
				`message=${safeStringify(error.message)}`,
				describeCause(error),
			),
			cause: error,
		});
	}
	const fallback = String(error);
	return new DeepSeekRequestError({
		message: fallback,
		kind: 'unknown',
		baseUrl: context.baseUrl,
		userSummary: t('error.unknown', fallback),
		diagnosticMessage: joinDiagnosticParts('kind=unknown', `value=${safeStringify(fallback)}`),
	});
}

/** Produce a plain `Error` whose message is markdown for display in chat (with action links). */
export function createUserFacingError(error: unknown): Error {
	const message =
		error instanceof DeepSeekRequestError
			? formatMarkdownMessage(error.userSummary, getErrorActions(error))
			: t('error.unknown', String(error));
	const displayError = new Error(message);
	displayError.stack = undefined;
	return displayError;
}

/** Build the list of inline action links to surface with an error in chat. */
function getErrorActions(error: DeepSeekRequestError): ErrorAction[] {
	const actions: ErrorAction[] = [];
	if (error.kind === 'http' && (error.status === 401 || error.status === 403)) {
		actions.push({ labelKey: 'error.action.setApiKey', url: SET_API_KEY_COMMAND });
	}
	actions.push({ labelKey: 'error.action.viewDetails', url: SHOW_LOGS_COMMAND });
	return actions;
}

function formatMarkdownMessage(summary: string, actions: ErrorAction[]): string {
	const formattedSummary = `**${escapeBoldText(summary)}**`;
	if (actions.length === 0) {
		return formattedSummary;
	}
	const actionLinks = actions.map(formatActionLink).join(' · ');
	return [`${formattedSummary}\\`, '\\', `**${actionLinks}**`].join('\n');
}

function formatActionLink(action: ErrorAction): string {
	return `[${t(action.labelKey)}](${action.url})`;
}

function escapeBoldText(value: string): string {
	return value.replace(/\*/gu, '\\*');
}

/** Format an error for the output channel log: kind + baseUrl + status + summary + diagnostic. */
export function formatRequestError(error: unknown): string {
	if (error instanceof DeepSeekRequestError) {
		return [
			`[${error.kind}]`,
			error.status ? `HTTP ${error.status}` : undefined,
			`baseUrl=${error.baseUrl}`,
			error.code ? `code=${error.code}` : undefined,
			`summary=${error.userSummary}`,
			`detail=${error.diagnosticMessage}`,
		]
			.filter(Boolean)
			.join(' ');
	}
	if (error instanceof Error) {
		return `${error.name}: ${error.message}`;
	}
	return String(error);
}

function getHttpErrorMessage(status: number, statusLabel: string, baseUrl: string): string {
	switch (status) {
		case 401:
		case 403:
			if (isOfficialBaseUrl(baseUrl)) {
				return t('error.http.401.withCreateApiKeyLink', statusLabel, EXTERNAL_URLS.apiKeys);
			}
			return t('error.http.401', statusLabel);
		case 400:
			return t('error.http.400', statusLabel);
		case 402:
			return t('error.http.402', statusLabel);
		case 404:
			return t('error.http.404', statusLabel);
		case 422:
			return t('error.http.422', statusLabel);
		case 429:
			return t('error.http.429', statusLabel);
		case 500:
			return t('error.http.500', statusLabel);
		case 503:
			return t('error.http.503', statusLabel);
		default:
			if (status >= 500 && status <= 599) {
				return t('error.http.500', statusLabel);
			}
			return t('error.http.generic', statusLabel);
	}
}

function describeCause(error: Error): string | undefined {
	const info = getNetworkErrorCauseInfo(error);
	if (!info) {
		return undefined;
	}
	const parts = [
		info.code ? `cause.code=${safeStringify(info.code)}` : undefined,
		info.name ? `cause.name=${safeStringify(info.name)}` : undefined,
		info.message ? `cause.message=${safeStringify(info.message)}` : undefined,
		`cause.value=${safeStringify(info.value)}`,
	];
	return parts.filter(Boolean).join(' ');
}

function isOfficialBaseUrl(baseUrl: string): boolean {
	try {
		return OFFICIAL_API_HOSTS.includes(new URL(baseUrl).hostname.toLowerCase());
	} catch {
		return false;
	}
}

function getNetworkErrorCategory(code: string | undefined): NetworkErrorCategory {
	if (!code) {
		return 'generic';
	}
	if (Object.hasOwn(NETWORK_ERROR_CATEGORY_BY_CODE, code)) {
		return NETWORK_ERROR_CATEGORY_BY_CODE[code];
	}
	if (code.startsWith('ERR_TLS_') || code.startsWith('ERR_SSL_')) {
		return 'tls';
	}
	return code.startsWith('HPE_') ? 'protocol' : 'generic';
}

function getNetworkErrorCauseInfo(error: Error): NetworkCauseInfo | undefined {
	const cause: unknown = error.cause;
	if (!cause) {
		return undefined;
	}
	if (cause instanceof Error) {
		const value: Record<string, unknown> = {
			name: cause.name,
			message: cause.message,
			...Object.fromEntries(Object.entries(cause)),
		};
		return {
			code: getStringProperty(value, 'code'),
			name: cause.name,
			message:
				cause.message && cause.message !== error.message
					? truncateSingleLine(cause.message)
					: undefined,
			value: stringifyDiagnosticCause(value),
		};
	}
	if (typeof cause === 'object') {
		return {
			code: getStringProperty(cause, 'code'),
			name: getStringProperty(cause, 'name'),
			message: truncateOptional(getStringProperty(cause, 'message')),
			value: stringifyDiagnosticCause(cause),
		};
	}
	return {
		message: truncateSingleLine(String(cause)),
		value: safeStringify(String(cause)),
	};
}

function getNetworkErrorCode(error: Error): string | undefined {
	const direct = getStringProperty(error, 'code');
	if (direct) {
		return direct;
	}
	const cause: unknown = error.cause;
	if (cause instanceof Error) {
		return getStringProperty(cause, 'code') ?? cause.name;
	}
	if (cause && typeof cause === 'object') {
		return getStringProperty(cause, 'code') ?? getStringProperty(cause, 'name');
	}
	return error.name === 'Error' ? undefined : error.name;
}

function extractServerMessage(responseText: string): string | undefined {
	const trimmed = responseText.trim();
	if (!trimmed) {
		return undefined;
	}
	try {
		const parsed: unknown = JSON.parse(trimmed);
		const errorValue = getObjectProperty(parsed, 'error');
		const message =
			getStringProperty(errorValue, 'message') ??
			getStringProperty(parsed, 'message') ??
			(typeof errorValue === 'string' ? errorValue : undefined);
		return message ? truncateSingleLine(message) : undefined;
	} catch {
		return truncateSingleLine(trimmed);
	}
}

function getObjectProperty(value: unknown, key: string): unknown {
	return typeof value === 'object' && value !== null
		? (value as Record<string, unknown>)[key]
		: undefined;
}

function getStringProperty(value: unknown, key: string): string | undefined {
	const property = getObjectProperty(value, key);
	return typeof property === 'string' && property.length > 0 ? property : undefined;
}

function joinDiagnosticParts(...parts: Array<string | undefined>): string {
	return parts.filter((part): part is string => Boolean(part)).join(' ');
}

function truncateSingleLine(value: string): string {
	const singleLine = value.replace(/\s+/gu, ' ').trim();
	return singleLine.length > MAX_DIAGNOSTIC_FIELD_LENGTH
		? `${singleLine.slice(0, MAX_DIAGNOSTIC_FIELD_LENGTH)}...`
		: singleLine;
}

function truncateOptional(value: string | undefined): string | undefined {
	return value ? truncateSingleLine(value) : undefined;
}

function stringifyDiagnosticCause(cause: unknown): string {
	try {
		return truncateSingleLine(safeStringify(cause));
	} catch {
		return safeStringify(String(cause));
	}
}
