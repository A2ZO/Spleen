export {
  APP_SCHEME,
  DISABLED_AUTH_PATHS,
  MAGIC_LINK_TTL_SECONDS,
  SIGN_IN_CODE_FAILURES,
  createAuth,
  getSessionUser,
  type Auth,
  type AuthOptions,
  type SessionUser,
} from "./auth";
export { magicLinkEmail, toLocale } from "./emails";
