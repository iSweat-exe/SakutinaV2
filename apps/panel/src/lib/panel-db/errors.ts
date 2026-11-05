/** The signed-in user is not an administrator of the server (SQLSTATE 42501 from a panel_* function). */
export class PanelForbiddenError extends Error {
  constructor() {
    super("Not authorized for this server");
    this.name = "PanelForbiddenError";
  }
}

/** The database answered, but not with what the panel expects (or did not answer). */
export class PanelDataError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PanelDataError";
  }
}
