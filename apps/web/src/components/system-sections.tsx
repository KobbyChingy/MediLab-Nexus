import {
  type AdminOverviewPayload,
  type AdminUserInput,
  type AdminUserSummaryPayload,
  type ChangeOwnPinInput,
  type FacilitySettingsInput,
  type IntegrationDispatchStatusPayload,
  type InternalAlertPayload,
  type UserDirectoryEntryPayload,
  printFontSizes,
  userRoles,
} from "@medilab/shared";
import type {
  ChangeEventHandler,
  Dispatch,
  FormEventHandler,
  RefObject,
  SetStateAction,
} from "react";
import { useMemo, useState } from "react";

type BackupRecord = {
  id: string;
  label: string;
  createdAt: string;
  restoredAt?: string | null;
  encrypted: boolean;
};

type PinRecoveryState = {
  userId: string;
  newPin: string;
};

type PasswordVisibilityState = {
  userCreate: boolean;
  recoverPin: boolean;
  selfCurrentPin: boolean;
  selfNewPin: boolean;
};

type BellFormState = {
  recipientUsername: string;
  message: string;
};

function InternalBellComposer(props: {
  bellForm: BellFormState;
  setBellForm: Dispatch<SetStateAction<BellFormState>>;
  bellRecipientOptions: UserDirectoryEntryPayload[];
  handleBellSubmit: FormEventHandler<HTMLFormElement>;
  title: string;
  description: string;
  closeAction?: React.ReactNode;
}) {
  const {
    bellForm,
    setBellForm,
    bellRecipientOptions,
    handleBellSubmit,
    title,
    description,
    closeAction,
  } = props;

  return (
    <>
      <div className="section-head compact-head">
        <div>
          <h2>{title}</h2>
          <p>{description}</p>
        </div>
      </div>
      <form className="bell-form" onSubmit={handleBellSubmit}>
        <label>
          <span>Recipient</span>
          <select
            value={bellForm.recipientUsername}
            onChange={(event) =>
              setBellForm((current) => ({
                ...current,
                recipientUsername: event.target.value,
              }))
            }
          >
            <option value="">Choose user</option>
            {bellRecipientOptions.map((user) => (
              <option key={user.id} value={user.username}>
                {user.displayName} ({user.role})
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Message</span>
          <textarea
            rows={3}
            value={bellForm.message}
            onChange={(event) =>
              setBellForm((current) => ({
                ...current,
                message: event.target.value,
              }))
            }
          />
        </label>
        <div className="action-row bell-actions">
          <button
            type="submit"
            disabled={
              !bellForm.recipientUsername || bellForm.message.trim().length < 4
            }
          >
            Send bell
          </button>
          {closeAction}
        </div>
      </form>
    </>
  );
}

function InternalBellInbox(props: {
  incomingAlerts: InternalAlertPayload[];
  dismissIncomingAlert: (alertId: string) => void;
  headingLevel?: "h2" | "h3";
}) {
  const { incomingAlerts, dismissIncomingAlert, headingLevel = "h2" } = props;
  const HeadingTag = headingLevel;

  return (
    <div className="bell-inbox">
      <div className="section-head compact-head">
        <div>
          <HeadingTag>Recent alerts</HeadingTag>
          <p>Alerts that reached this session.</p>
        </div>
      </div>
      {incomingAlerts.length > 0 ? (
        <div className="bell-alert-list">
          {incomingAlerts.map((alert) => (
            <article key={alert.id} className="bell-alert-card">
              <strong>{alert.createdBy}</strong>
              <p>{alert.message}</p>
              <button
                type="button"
                className="ghost-action small"
                onClick={() => dismissIncomingAlert(alert.id)}
              >
                Dismiss
              </button>
            </article>
          ))}
        </div>
      ) : (
        <p className="muted-copy">
          No active internal alerts for you right now.
        </p>
      )}
    </div>
  );
}

export function InternalBellPanel(props: {
  bellForm: BellFormState;
  setBellForm: Dispatch<SetStateAction<BellFormState>>;
  bellRecipientOptions: UserDirectoryEntryPayload[];
  handleBellSubmit: FormEventHandler<HTMLFormElement>;
  incomingAlerts: InternalAlertPayload[];
  dismissIncomingAlert: (alertId: string) => void;
  onClose: () => void;
}) {
  const {
    bellForm,
    setBellForm,
    bellRecipientOptions,
    handleBellSubmit,
    incomingAlerts,
    dismissIncomingAlert,
    onClose,
  } = props;

  return (
    <div className="surface-card bell-panel">
      <InternalBellComposer
        bellForm={bellForm}
        setBellForm={setBellForm}
        bellRecipientOptions={bellRecipientOptions}
        handleBellSubmit={handleBellSubmit}
        title="Call a user"
        description="Send an internal chime that says you need help."
        closeAction={
          <button
            type="button"
            className="ghost-action small"
            onClick={onClose}
          >
            Close
          </button>
        }
      />
      <InternalBellInbox
        incomingAlerts={incomingAlerts}
        dismissIncomingAlert={dismissIncomingAlert}
        headingLevel="h3"
      />
    </div>
  );
}

export function SystemUserManagementSection(props: {
  canManageUsers: boolean;
  currentUsername: string;
  userForm: AdminUserInput;
  setUserForm: Dispatch<SetStateAction<AdminUserInput>>;
  passwordVisibility: PasswordVisibilityState;
  togglePasswordVisibility: (
    field:
      | "userCreate"
      | "recoverPin"
      | "selfCurrentPin"
      | "selfNewPin",
  ) => void;
  handleUserCreate: FormEventHandler<HTMLFormElement>;
  pinRecovery: PinRecoveryState;
  setPinRecovery: Dispatch<SetStateAction<PinRecoveryState>>;
  handleRecoverPin: FormEventHandler<HTMLFormElement>;
  selfPinChange: ChangeOwnPinInput;
  setSelfPinChange: Dispatch<SetStateAction<ChangeOwnPinInput>>;
  handleChangeOwnPin: FormEventHandler<HTMLFormElement>;
  users: AdminUserSummaryPayload[];
  formatDate: (value?: string | null) => string;
  handleToggleUser: (userId: string, isActive: boolean) => void;
  handleUnlockUser: (userId: string) => void;
}) {
  const {
    canManageUsers,
    currentUsername,
    userForm,
    setUserForm,
    passwordVisibility,
    togglePasswordVisibility,
    handleUserCreate,
    pinRecovery,
    setPinRecovery,
    handleRecoverPin,
    selfPinChange,
    setSelfPinChange,
    handleChangeOwnPin,
    users,
    formatDate,
    handleToggleUser,
    handleUnlockUser,
  } = props;
  const [showCreateUserForm, setShowCreateUserForm] = useState(false);
  const [showChangeOwnPinForm, setShowChangeOwnPinForm] = useState(false);
  const [userSearchQuery, setUserSearchQuery] = useState("");
  const [selectedUserRole, setSelectedUserRole] = useState<"ALL" | string>(
    "ALL",
  );
  const [selectedUserState, setSelectedUserState] = useState<
    "ALL" | "ACTIVE" | "LOCKED" | "INACTIVE"
  >("ALL");

  const filteredUsers = useMemo(() => {
    const normalizedQuery = userSearchQuery.trim().toLowerCase();

    return users.filter((user) => {
      if (selectedUserRole !== "ALL" && user.role !== selectedUserRole) {
        return false;
      }

      if (selectedUserState === "ACTIVE" && !user.isActive) {
        return false;
      }
      if (selectedUserState === "INACTIVE" && user.isActive) {
        return false;
      }
      if (selectedUserState === "LOCKED" && !user.lockedUntil) {
        return false;
      }

      if (!normalizedQuery) {
        return true;
      }

      return [user.displayName, user.username, user.role]
        .some((value) => value.toLowerCase().includes(normalizedQuery));
    });
  }, [selectedUserRole, selectedUserState, userSearchQuery, users]);

  const lockedCount = useMemo(
    () => users.filter((user) => Boolean(user.lockedUntil)).length,
    [users],
  );

  const activeCount = useMemo(
    () => users.filter((user) => user.isActive).length,
    [users],
  );

  const recoveryUser = useMemo(
    () => users.find((user) => user.id === pinRecovery.userId) ?? null,
    [pinRecovery.userId, users],
  );

  return (
    <section className="content-grid">
      <article className="surface-card workspace-table-card">
        <div className="section-head">
          <div>
            <h2>Users and access</h2>
            <p>Create accounts, change your PIN, recover user PINs, and reset lockouts.</p>
          </div>
          <div className="inline-actions">
            <button
              type="button"
              className="ghost-action"
              onClick={() => setShowChangeOwnPinForm((current) => !current)}
            >
              {showChangeOwnPinForm ? "Close PIN change" : "Change my PIN"}
            </button>
            <button
              type="button"
              className="primary-action"
              onClick={() => setShowCreateUserForm((current) => !current)}
              disabled={!canManageUsers}
            >
              {showCreateUserForm ? "Close add user" : "Add user"}
            </button>
          </div>
        </div>
        {showCreateUserForm ? (
          <form className="form-grid bordered-top" onSubmit={handleUserCreate}>
            <label>
              <span>Username</span>
              <input
                value={userForm.username}
                onChange={(event) =>
                  setUserForm((current) => ({
                    ...current,
                    username: event.target.value,
                  }))
                }
                disabled={!canManageUsers}
              />
            </label>
            <label>
              <span>Display name</span>
              <input
                value={userForm.displayName}
                onChange={(event) =>
                  setUserForm((current) => ({
                    ...current,
                    displayName: event.target.value,
                  }))
                }
                disabled={!canManageUsers}
              />
            </label>
            <label>
              <span>Role</span>
              <select
                value={userForm.role}
                onChange={(event) =>
                  setUserForm((current) => ({
                    ...current,
                    role: event.target.value as AdminUserInput["role"],
                  }))
                }
                disabled={!canManageUsers}
              >
                {userRoles.map((role) => (
                  <option key={role} value={role}>
                    {role}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Initial PIN</span>
              <div className="password-field">
                <input
                  type={passwordVisibility.userCreate ? "text" : "password"}
                  value={userForm.pin}
                  onChange={(event) =>
                    setUserForm((current) => ({
                      ...current,
                      pin: event.target.value,
                    }))
                  }
                  disabled={!canManageUsers}
                />
                <button
                  type="button"
                  className="field-action-button"
                  onClick={() => togglePasswordVisibility("userCreate")}
                >
                  {passwordVisibility.userCreate ? "Hide" : "Show"}
                </button>
              </div>
            </label>
            <div className="full-width action-row">
              <button type="submit" disabled={!canManageUsers}>
                Create user
              </button>
            </div>
          </form>
        ) : null}
        {showChangeOwnPinForm ? (
          <form className="form-grid bordered-top" onSubmit={handleChangeOwnPin}>
            <div className="full-width section-head compact-head">
              <div>
                <h3>Change my PIN</h3>
                <p>Signed in as {currentUsername || "current user"}.</p>
              </div>
            </div>
            <label>
              <span>Current PIN</span>
              <div className="password-field">
                <input
                  type={passwordVisibility.selfCurrentPin ? "text" : "password"}
                  value={selfPinChange.currentPin}
                  onChange={(event) =>
                    setSelfPinChange((current) => ({
                      ...current,
                      currentPin: event.target.value,
                    }))
                  }
                />
                <button
                  type="button"
                  className="field-action-button"
                  onClick={() => togglePasswordVisibility("selfCurrentPin")}
                >
                  {passwordVisibility.selfCurrentPin ? "Hide" : "Show"}
                </button>
              </div>
            </label>
            <label>
              <span>New PIN</span>
              <div className="password-field">
                <input
                  type={passwordVisibility.selfNewPin ? "text" : "password"}
                  value={selfPinChange.newPin}
                  onChange={(event) =>
                    setSelfPinChange((current) => ({
                      ...current,
                      newPin: event.target.value,
                    }))
                  }
                />
                <button
                  type="button"
                  className="field-action-button"
                  onClick={() => togglePasswordVisibility("selfNewPin")}
                >
                  {passwordVisibility.selfNewPin ? "Hide" : "Show"}
                </button>
              </div>
            </label>
            <div className="full-width action-row">
              <button type="submit">Change PIN</button>
            </div>
          </form>
        ) : null}
        {recoveryUser ? (
          <form className="form-grid bordered-top" onSubmit={handleRecoverPin}>
            <div className="full-width section-head compact-head">
              <div>
                <h3>PIN recovery</h3>
                <p>Reset the PIN for {recoveryUser.displayName} and share the new value securely.</p>
              </div>
            </div>
            <label>
              <span>User</span>
              <input value={`${recoveryUser.displayName} (${recoveryUser.username})`} disabled />
            </label>
            <label>
              <span>Recovery PIN</span>
              <div className="password-field">
                <input
                  type={passwordVisibility.recoverPin ? "text" : "password"}
                  value={pinRecovery.newPin}
                  onChange={(event) =>
                    setPinRecovery((current) => ({
                      ...current,
                      newPin: event.target.value,
                    }))
                  }
                  disabled={!canManageUsers}
                />
                <button
                  type="button"
                  className="field-action-button"
                  onClick={() => togglePasswordVisibility("recoverPin")}
                >
                  {passwordVisibility.recoverPin ? "Hide" : "Show"}
                </button>
              </div>
            </label>
            <div className="full-width action-row">
              <button type="submit" disabled={!canManageUsers}>
                Recover PIN
              </button>
              <button
                type="button"
                className="ghost-action"
                onClick={() => setPinRecovery({ userId: "", newPin: "" })}
              >
                Cancel
              </button>
            </div>
          </form>
        ) : null}
        <div className="audit-log-toolbar">
          <label className="audit-log-search">
            <span>Search users</span>
            <input
              value={userSearchQuery}
              onChange={(event) => setUserSearchQuery(event.target.value)}
              placeholder="Search by display name, username, or role"
            />
          </label>
          <div className="study-filter-row audit-log-filter-row">
            <div className="pill-filter-group">
              <button
                type="button"
                className={`pill-filter${selectedUserRole === "ALL" ? " active" : ""}`}
                onClick={() => setSelectedUserRole("ALL")}
              >
                All roles
              </button>
              {userRoles.map((role) => (
                <button
                  key={role}
                  type="button"
                  className={`pill-filter${selectedUserRole === role ? " active" : ""}`}
                  onClick={() => setSelectedUserRole(role)}
                >
                  {role}
                </button>
              ))}
            </div>
            <div className="pill-filter-group">
              {(["ALL", "ACTIVE", "LOCKED", "INACTIVE"] as const).map(
                (state) => (
                  <button
                    key={state}
                    type="button"
                    className={`pill-filter${selectedUserState === state ? " active" : ""}`}
                    onClick={() => setSelectedUserState(state)}
                  >
                    {state}
                  </button>
                ),
              )}
            </div>
          </div>
          <div className="audit-log-metrics">
            <div className="metric-mini audit-log-metric">
              <span>Visible users</span>
              <strong>{filteredUsers.length}</strong>
            </div>
            <div className="metric-mini audit-log-metric">
              <span>Active accounts</span>
              <strong>{activeCount}</strong>
            </div>
            <div className="metric-mini audit-log-metric">
              <span>Locked accounts</span>
              <strong>{lockedCount}</strong>
            </div>
          </div>
        </div>
        <div className="audit-log-table-shell compact-scroll admin-table-shell">
          <table className="audit-log-table admin-table">
            <thead>
              <tr>
                <th>User</th>
                <th>Role</th>
                <th>Status</th>
                <th>PIN status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((user) => (
                <tr key={user.id}>
                  <td>
                    <strong>{user.displayName}</strong>
                    <div className="admin-table-subcopy">{user.username}</div>
                  </td>
                  <td>{user.role}</td>
                  <td>
                    {user.isActive ? "Active" : "Inactive"}
                    {user.lockedUntil ? " · Locked" : ""}
                  </td>
                  <td>
                    {user.lockedUntil
                      ? `Locked until ${formatDate(user.lockedUntil)}`
                      : `PIN changed ${formatDate(user.pinChangedAt)}`}
                  </td>
                  <td>
                    <div className="inline-actions admin-table-actions">
                      <button
                        type="button"
                        className="ghost-action small"
                        onClick={() =>
                          setPinRecovery({ userId: user.id, newPin: "" })
                        }
                        disabled={!canManageUsers}
                      >
                        Recover PIN
                      </button>
                      <button
                        type="button"
                        className="ghost-action small"
                        onClick={() => handleToggleUser(user.id, !user.isActive)}
                        disabled={!canManageUsers}
                      >
                        {user.isActive ? "Deactivate" : "Activate"}
                      </button>
                      <button
                        type="button"
                        className="primary-action small"
                        onClick={() => handleUnlockUser(user.id)}
                        disabled={!canManageUsers || !user.lockedUntil}
                      >
                        Unlock
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={5}>No users match the current filters.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </article>
    </section>
  );
}

export function SystemAlertsSection(props: {
  bellForm: BellFormState;
  setBellForm: Dispatch<SetStateAction<BellFormState>>;
  bellRecipientOptions: UserDirectoryEntryPayload[];
  handleBellSubmit: FormEventHandler<HTMLFormElement>;
  incomingAlerts: InternalAlertPayload[];
  dismissIncomingAlert: (alertId: string) => void;
  notificationItems: AdminOverviewPayload["notifications"]["items"];
  formatDate: (value?: string | null) => string;
}) {
  const {
    bellForm,
    setBellForm,
    bellRecipientOptions,
    handleBellSubmit,
    incomingAlerts,
    dismissIncomingAlert,
    notificationItems,
    formatDate,
  } = props;
  const [notificationSearchQuery, setNotificationSearchQuery] = useState("");
  const [selectedNotificationStatus, setSelectedNotificationStatus] =
    useState<"ALL" | string>("ALL");

  const notificationStatusOptions = useMemo(
    () =>
      Array.from(
        new Set(notificationItems.map((item) => item.status).filter(Boolean)),
      ),
    [notificationItems],
  );

  const filteredNotifications = useMemo(() => {
    const normalizedQuery = notificationSearchQuery.trim().toLowerCase();

    return notificationItems.filter((item) => {
      if (
        selectedNotificationStatus !== "ALL" &&
        item.status !== selectedNotificationStatus
      ) {
        return false;
      }

      if (!normalizedQuery) {
        return true;
      }

      return [item.channel, item.recipient, item.status, item.message]
        .map((value) => value ?? "")
        .some((value) => value.toLowerCase().includes(normalizedQuery));
    });
  }, [notificationItems, notificationSearchQuery, selectedNotificationStatus]);

  const queuedRecipientCount = useMemo(
    () => new Set(notificationItems.map((item) => item.recipient)).size,
    [notificationItems],
  );

  return (
    <section className="content-grid admin-workspace-layout">
      <article className="surface-card workspace-form-card">
        <InternalBellComposer
          bellForm={bellForm}
          setBellForm={setBellForm}
          bellRecipientOptions={bellRecipientOptions}
          handleBellSubmit={handleBellSubmit}
          title="Internal alerts"
          description="Send an internal bell and review alerts that reached this session."
        />
      </article>

      <article className="surface-card workspace-table-card">
        <div className="section-head compact-head">
          <div>
            <h2>Alert operations</h2>
            <p>Monitor internal bells and outbound notifications from one workspace.</p>
          </div>
        </div>
        <div className="audit-log-metrics">
          <div className="metric-mini audit-log-metric">
            <span>Incoming alerts</span>
            <strong>{incomingAlerts.length}</strong>
          </div>
          <div className="metric-mini audit-log-metric">
            <span>Queued notifications</span>
            <strong>{notificationItems.length}</strong>
          </div>
          <div className="metric-mini audit-log-metric">
            <span>Queued recipients</span>
            <strong>{queuedRecipientCount}</strong>
          </div>
        </div>
        <div className="admin-split-panels">
          <div className="surface-subpanel">
            <InternalBellInbox
              incomingAlerts={incomingAlerts}
              dismissIncomingAlert={dismissIncomingAlert}
            />
          </div>
          <div className="surface-subpanel">
            <div className="section-head compact-head">
              <div>
                <h3>Queued notifications</h3>
                <p>Outbound notices waiting in the system queue.</p>
              </div>
            </div>
            <div className="audit-log-toolbar">
              <label className="audit-log-search">
                <span>Search queue</span>
                <input
                  value={notificationSearchQuery}
                  onChange={(event) => setNotificationSearchQuery(event.target.value)}
                  placeholder="Search recipient, channel, status, or message"
                />
              </label>
              <div className="study-filter-row audit-log-filter-row">
                <div className="pill-filter-group">
                  <button
                    type="button"
                    className={`pill-filter${selectedNotificationStatus === "ALL" ? " active" : ""}`}
                    onClick={() => setSelectedNotificationStatus("ALL")}
                  >
                    All statuses
                  </button>
                  {notificationStatusOptions.map((status) => (
                    <button
                      key={status}
                      type="button"
                      className={`pill-filter${selectedNotificationStatus === status ? " active" : ""}`}
                      onClick={() => setSelectedNotificationStatus(status)}
                    >
                      {status}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            {filteredNotifications.length === 0 ? (
              <div className="chart-empty audit-log-empty-state">
                No queued notifications match the current filters.
              </div>
            ) : (
              <div className="audit-log-table-shell compact-scroll admin-table-shell">
                <table className="audit-log-table admin-table">
                  <thead>
                    <tr>
                      <th>Channel</th>
                      <th>Recipient</th>
                      <th>Status</th>
                      <th>Message</th>
                      <th>Created At</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredNotifications.map((item, index) => (
                      <tr key={`${item.recipient}-${item.createdAt}-${index}`}>
                        <td>{item.channel}</td>
                        <td>{item.recipient}</td>
                        <td>{item.status}</td>
                        <td>{item.message}</td>
                        <td>{formatDate(item.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </article>
    </section>
  );
}

export function SystemAuditLogsSection(props: {
  auditTrail: AdminOverviewPayload["auditTrail"];
  formatDate: (value?: string | null) => string;
}) {
  const { auditTrail, formatDate } = props;
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRole, setSelectedRole] = useState<"ALL" | string>("ALL");

  const roleOptions = useMemo(
    () =>
      Array.from(new Set(auditTrail.map((entry) => entry.role).filter(Boolean))),
    [auditTrail],
  );

  const filteredAuditTrail = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();

    return auditTrail.filter((entry) => {
      if (selectedRole !== "ALL" && entry.role !== selectedRole) {
        return false;
      }

      if (!normalizedQuery) {
        return true;
      }

      return [
        entry.action,
        entry.entityType,
        entry.traceCode,
        entry.summary,
        entry.role,
      ]
        .map((value) => value ?? "")
        .some((value) => value.toLowerCase().includes(normalizedQuery));
    });
  }, [auditTrail, searchQuery, selectedRole]);

  const visibleActionCount = useMemo(
    () => new Set(filteredAuditTrail.map((entry) => entry.action)).size,
    [filteredAuditTrail],
  );

  const latestActivity = filteredAuditTrail[0]?.createdAt;

  return (
    <section className="content-grid audit-log-layout">
      <article className="surface-card audit-log-card">
        <div className="section-head">
          <div>
            <h2>System Audit Logs</h2>
            <p>Track all significant system activities.</p>
          </div>
        </div>
        <div className="audit-log-toolbar">
          <label className="audit-log-search">
            <span>Search activity</span>
            <input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search action, summary, trace code, or role"
            />
          </label>
          <div className="study-filter-row audit-log-filter-row">
            <div className="pill-filter-group">
              <button
                type="button"
                className={`pill-filter${selectedRole === "ALL" ? " active" : ""}`}
                onClick={() => setSelectedRole("ALL")}
              >
                All roles
              </button>
              {roleOptions.map((role) => (
                <button
                  key={role}
                  type="button"
                  className={`pill-filter${selectedRole === role ? " active" : ""}`}
                  onClick={() => setSelectedRole(role)}
                >
                  {role}
                </button>
              ))}
            </div>
          </div>
          <div className="audit-log-metrics">
            <div className="metric-mini audit-log-metric">
              <span>Visible events</span>
              <strong>{filteredAuditTrail.length}</strong>
            </div>
            <div className="metric-mini audit-log-metric">
              <span>Actions covered</span>
              <strong>{visibleActionCount}</strong>
            </div>
            <div className="metric-mini audit-log-metric">
              <span>Latest activity</span>
              <strong>{latestActivity ? formatDate(latestActivity) : "No activity"}</strong>
            </div>
          </div>
        </div>
        {filteredAuditTrail.length === 0 ? (
          <div className="chart-empty audit-log-empty-state">
            No audit events match the current filters.
          </div>
        ) : (
          <div className="audit-log-table-shell compact-scroll audit-log-list">
            <table className="audit-log-table">
              <thead>
                <tr>
                  <th>Action</th>
                  <th>Entity</th>
                  <th>Trace Code</th>
                  <th>Summary</th>
                  <th>Role</th>
                  <th>Occurred At</th>
                </tr>
              </thead>
              <tbody>
                {filteredAuditTrail.map((entry, index) => (
                  <tr key={`${entry.createdAt}-${entry.action}-${index}`}>
                    <td>{entry.action}</td>
                    <td>{entry.entityType}</td>
                    <td>{entry.traceCode || "-"}</td>
                    <td>{entry.summary}</td>
                    <td>{entry.role}</td>
                    <td>{formatDate(entry.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </article>
    </section>
  );
}

export function SystemSettingsSection(props: {
  facilityForm: FacilitySettingsInput;
  setFacilityForm: Dispatch<SetStateAction<FacilitySettingsInput>>;
  handleFacilitySave: FormEventHandler<HTMLFormElement>;
  handleFacilityLogoChange: ChangeEventHandler<HTMLInputElement>;
  canManageUsers: boolean;
  canEditPrintSettings: boolean;
  logoSrc: string;
  fallbackFacilityName: string;
  canManageBackups: boolean;
  canManageIntegrations: boolean;
  handleBackupCreate: () => void;
  handleBackupExport: () => void;
  handleBackupImport: ChangeEventHandler<HTMLInputElement>;
  handleBackupImportPrompt: () => void;
  backupImportInputRef: RefObject<HTMLInputElement | null>;
  handleRestoreLatest: () => void;
  handleRunIntegrationDispatch: () => void;
  selectedBackupId: string;
  setSelectedBackupId: Dispatch<SetStateAction<string>>;
  backups: BackupRecord[];
  syncStatus: IntegrationDispatchStatusPayload;
}) {
  const {
    facilityForm,
    setFacilityForm,
    handleFacilitySave,
    handleFacilityLogoChange,
    canManageUsers,
    canEditPrintSettings,
    logoSrc,
    fallbackFacilityName,
    canManageBackups,
    canManageIntegrations,
    handleBackupCreate,
    handleBackupExport,
    handleBackupImport,
    handleBackupImportPrompt,
    backupImportInputRef,
    handleRestoreLatest,
    handleRunIntegrationDispatch,
    selectedBackupId,
    setSelectedBackupId,
    backups,
    syncStatus,
  } = props;

  const latestBackup = backups[0];
  const restoredBackupCount = useMemo(
    () => backups.filter((backup) => Boolean(backup.restoredAt)).length,
    [backups],
  );

  return (
    <section className="content-grid admin-workspace-layout">
      <article className="surface-card form-card workspace-form-card">
        <div className="section-head">
          <div>
            <h2>Facility profile</h2>
            <p>
              Set the lab name, logo, contacts, and footer shown on reports,
              receipts, and invoice printouts.
            </p>
          </div>
        </div>
        {!canManageUsers ? (
          <div className="summary-panel full-width">
            <span>View only</span>
            <strong>Profile details are locked in this portal</strong>
            <p className="muted-copy">
              Reception can view the facility details here, but only the manager
              or admin can change them. Doctors and sonographers can still save
              printable font size below.
            </p>
          </div>
        ) : null}
        <form className="form-grid" onSubmit={handleFacilitySave}>
          <label>
            <span>Lab name</span>
            <input
              value={facilityForm.name}
              onChange={(event) =>
                setFacilityForm((current) => ({
                  ...current,
                  name: event.target.value,
                }))
              }
              disabled={!canManageUsers}
            />
          </label>
          <label>
            <span>Phone number</span>
            <input
              value={facilityForm.phone}
              onChange={(event) =>
                setFacilityForm((current) => ({
                  ...current,
                  phone: event.target.value,
                }))
              }
              disabled={!canManageUsers}
            />
          </label>
          <label>
            <span>Email</span>
            <input
              type="email"
              value={facilityForm.email}
              onChange={(event) =>
                setFacilityForm((current) => ({
                  ...current,
                  email: event.target.value,
                }))
              }
              disabled={!canManageUsers}
            />
          </label>
          <label>
            <span>Location</span>
            <input
              value={facilityForm.location}
              onChange={(event) =>
                setFacilityForm((current) => ({
                  ...current,
                  location: event.target.value,
                }))
              }
              disabled={!canManageUsers}
            />
          </label>
          <label className="full-width">
            <span>Lab logo</span>
            <input
              type="file"
              accept="image/png,image/jpeg"
              onChange={handleFacilityLogoChange}
              disabled={!canManageUsers}
            />
          </label>
          <div className="full-width branding-preview">
            <div className="branding-preview-card">
              {facilityForm.logoDataUrl ? (
                <img
                  src={facilityForm.logoDataUrl}
                  alt="Facility logo preview"
                  className="facility-logo-preview"
                />
              ) : (
                <img
                  src={logoSrc}
                  alt="Default MediLab Nexus logo"
                  className="facility-logo-preview"
                />
              )}
              <div>
                <strong>{facilityForm.name || fallbackFacilityName}</strong>
                <span>
                  {[
                    facilityForm.location,
                    facilityForm.phone,
                    facilityForm.email,
                  ]
                    .filter(Boolean)
                    .join(" · ") || "Receipt and report header preview"}
                </span>
                <small>
                  PNG or JPG only. Logos are resized to fit within 512px for
                  fast loading across web and print surfaces.
                </small>
              </div>
              <button
                type="button"
                className="ghost-action small"
                onClick={() =>
                  setFacilityForm((current) => ({
                    ...current,
                    logoDataUrl: "",
                  }))
                }
                disabled={!canManageUsers || !facilityForm.logoDataUrl}
              >
                Remove logo
              </button>
            </div>
          </div>
          <label className="full-width">
            <span>Printable font size</span>
            <select
              value={facilityForm.printFontSize}
              onChange={(event) =>
                setFacilityForm((current) => ({
                  ...current,
                  printFontSize: event.target
                    .value as FacilitySettingsInput["printFontSize"],
                }))
              }
              disabled={!canEditPrintSettings}
            >
              {printFontSizes.map((fontSize) => (
                <option key={fontSize} value={fontSize}>
                  {fontSize === "SMALL"
                    ? "Small"
                    : fontSize === "LARGE"
                      ? "Large"
                      : "Medium"}
                </option>
              ))}
            </select>
          </label>
          <label className="full-width">
            <span>Footer message</span>
            <textarea
              rows={4}
              value={facilityForm.footerMessage}
              onChange={(event) =>
                setFacilityForm((current) => ({
                  ...current,
                  footerMessage: event.target.value,
                }))
              }
              disabled={!canManageUsers}
            />
          </label>
          <div className="full-width action-row">
            <button
              type="submit"
              disabled={!canManageUsers && !canEditPrintSettings}
            >
              Save facility profile
            </button>
          </div>
        </form>
      </article>

      <article className="surface-card workspace-table-card">
        <div className="section-head compact-head">
          <div>
            <h2>System operations</h2>
            <p>Backups, integration dispatch, and runtime health.</p>
          </div>
        </div>
        <div className="audit-log-metrics">
          <div className="metric-mini audit-log-metric">
            <span>Backup snapshots</span>
            <strong>{backups.length}</strong>
          </div>
          <div className="metric-mini audit-log-metric">
            <span>Restored snapshots</span>
            <strong>{restoredBackupCount}</strong>
          </div>
          <div className="metric-mini audit-log-metric">
            <span>Pending dispatches</span>
            <strong>{syncStatus.pending}</strong>
          </div>
        </div>
        <div className="system-action-row admin-table-actions">
          <input
            ref={backupImportInputRef}
            type="file"
            accept=".enc,text/plain,application/octet-stream"
            onChange={handleBackupImport}
            hidden
          />
          <button
            type="button"
            className="primary-action"
            onClick={handleBackupCreate}
            disabled={!canManageBackups}
          >
            Create backup
          </button>
          <button
            type="button"
            className="ghost-action"
            onClick={handleBackupExport}
            disabled={!canManageBackups || !selectedBackupId}
          >
            Export backup
          </button>
          <button
            type="button"
            className="ghost-action"
            onClick={handleBackupImportPrompt}
            disabled={!canManageBackups}
          >
            Import backup
          </button>
          <button
            type="button"
            className="ghost-action"
            onClick={handleRestoreLatest}
            disabled={!canManageBackups || !selectedBackupId}
          >
            Restore backup
          </button>
          <button
            type="button"
            className="ghost-action"
            onClick={handleRunIntegrationDispatch}
            disabled={!canManageIntegrations}
          >
            Run dispatch
          </button>
        </div>
        <div className="admin-split-panels">
          <div className="surface-subpanel">
            <div className="section-head compact-head">
              <div>
                <h3>Backup library</h3>
                <p>Select a snapshot and review restore history.</p>
              </div>
            </div>
            <label>
              <span>Backup snapshots</span>
              <select
                value={selectedBackupId}
                onChange={(event) => setSelectedBackupId(event.target.value)}
              >
                <option value="">Select backup</option>
                {backups.map((backup) => (
                  <option key={backup.id} value={backup.id}>
                    {backup.label}
                  </option>
                ))}
              </select>
            </label>
            {backups.length === 0 ? (
              <div className="chart-empty audit-log-empty-state">
                No backup snapshots are available yet.
              </div>
            ) : (
              <div className="audit-log-table-shell compact-scroll admin-table-shell">
                <table className="audit-log-table admin-table">
                  <thead>
                    <tr>
                      <th>Snapshot</th>
                      <th>Created At</th>
                      <th>Restored At</th>
                      <th>Security</th>
                    </tr>
                  </thead>
                  <tbody>
                    {backups.map((backup) => (
                      <tr key={backup.id}>
                        <td>
                          <strong>{backup.label}</strong>
                          <div className="admin-table-subcopy">
                            {backup.id === selectedBackupId
                              ? "Selected snapshot"
                              : backup.id === latestBackup?.id
                                ? "Latest snapshot"
                                : "Available snapshot"}
                          </div>
                        </td>
                        <td>{new Date(backup.createdAt).toLocaleString()}</td>
                        <td>
                          {backup.restoredAt
                            ? new Date(backup.restoredAt).toLocaleString()
                            : "Never restored"}
                        </td>
                        <td>{backup.encrypted ? "Encrypted" : "Standard"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          <div className="surface-subpanel">
            <div className="section-head compact-head">
              <div>
                <h3>Runtime status</h3>
                <p>Integration throughput, worker cadence, and dispatch health.</p>
              </div>
            </div>
            <div className="mini-status-grid">
              <div className="mini-status">
                <span>Integration mode</span>
                <strong>{syncStatus.mode}</strong>
              </div>
              <div className="mini-status">
                <span>Pending dispatches</span>
                <strong>{syncStatus.pending}</strong>
              </div>
              <div className="mini-status">
                <span>Conflicts</span>
                <strong>{syncStatus.conflicts}</strong>
              </div>
              <div className="mini-status">
                <span>Last dispatch</span>
                <strong>
                  {syncStatus.lastAttemptAt
                    ? new Date(syncStatus.lastAttemptAt).toLocaleTimeString()
                    : "Never"}
                </strong>
              </div>
              <div className="mini-status">
                <span>Worker batch</span>
                <strong>{syncStatus.worker.batchSize}</strong>
              </div>
              <div className="mini-status">
                <span>Last worker run</span>
                <strong>{syncStatus.lastRun?.processedEvents ?? 0}</strong>
              </div>
            </div>
          </div>
        </div>
      </article>
    </section>
  );
}
