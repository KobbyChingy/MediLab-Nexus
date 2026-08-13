import {
  type AdminOverviewPayload,
  type AttendanceSettingsInput,
  type AttendanceWorkspacePayload,
  type AdminUserInput,
  type AdminUserSummaryPayload,
  type ChangeOwnPinInput,
  type FacilitySettingsInput,
  type IntegrationDispatchStatusPayload,
  type InternalAlertPayload,
  type OwnProfileInput,
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
  panelId?: string;
  bellForm: BellFormState;
  setBellForm: Dispatch<SetStateAction<BellFormState>>;
  bellRecipientOptions: UserDirectoryEntryPayload[];
  handleBellSubmit: FormEventHandler<HTMLFormElement>;
  incomingAlerts: InternalAlertPayload[];
  dismissIncomingAlert: (alertId: string) => void;
  onClose: () => void;
}) {
  const {
    panelId,
    bellForm,
    setBellForm,
    bellRecipientOptions,
    handleBellSubmit,
    incomingAlerts,
    dismissIncomingAlert,
    onClose,
  } = props;

  return (
    <div
      id={panelId}
      className="surface-card bell-panel"
      role="dialog"
      aria-label="Alerts panel"
    >
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
  statusText: string;
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
  handleDeleteUser: (userId: string) => void;
}) {
  const {
    canManageUsers,
    statusText,
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
    handleDeleteUser,
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

  const hasVisibleStatusMessage =
    statusText !== "Ready to connect" && statusText !== "Signed out";

  return (
    <section className="content-grid">
      <article className="surface-card workspace-table-card audit-match-card user-management-card">
        <div className="section-head audit-match-head">
          <div>
            <h2>User Management</h2>
            <p>Manage staff access, role assignment, and account recovery.</p>
          </div>
          <div className="inline-actions user-management-hero-actions">
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
              {showCreateUserForm ? "Close add user" : "Add User"}
            </button>
          </div>
        </div>
        <div className="audit-log-toolbar audit-match-toolbar">
          <label className="audit-log-search audit-match-search">
            <span>Search users</span>
            <input
              value={userSearchQuery}
              onChange={(event) => setUserSearchQuery(event.target.value)}
              placeholder="Search by display name, username, or role"
            />
          </label>
          <div className="study-filter-row audit-log-filter-row audit-match-filter-row">
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
          <div className="audit-log-metrics audit-match-metrics user-management-metrics">
            <div className="metric-mini audit-log-metric audit-match-metric">
              <span>Visible users</span>
              <strong>{filteredUsers.length}</strong>
            </div>
            <div className="metric-mini audit-log-metric audit-match-metric">
              <span>Active accounts</span>
              <strong>{activeCount}</strong>
            </div>
            <div className="metric-mini audit-log-metric audit-match-metric">
              <span>Locked accounts</span>
              <strong>{lockedCount}</strong>
            </div>
          </div>
        </div>
        <div className="audit-log-table-shell compact-scroll admin-table-shell audit-match-table-shell">
          <table className="audit-log-table admin-table audit-match-table user-management-table">
            <thead>
              <tr>
                <th>User</th>
                <th>Role</th>
                <th>PIN status</th>
                <th>Account status</th>
                <th>Joined</th>
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
                  <td>
                    <span
                      className={`audit-action-badge ${
                        user.role === "ADMIN"
                          ? "tag-critical"
                          : user.role === "MANAGER"
                            ? "status-pill"
                            : "tag-good"
                      }`}
                    >
                      {user.role}
                    </span>
                  </td>
                  <td>
                    {user.lockedUntil
                      ? `Locked until ${formatDate(user.lockedUntil)}`
                      : `PIN changed ${formatDate(user.pinChangedAt)}`}
                  </td>
                  <td>
                    {user.isActive ? "Active" : "Inactive"}
                    {user.lockedUntil ? " · Locked" : ""}
                  </td>
                  <td>{new Date(user.createdAt).toLocaleDateString()}</td>
                  <td>
                    <div className="inline-actions admin-table-actions user-row-actions">
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
                      <button
                        type="button"
                        className="ghost-action small"
                        onClick={() => handleDeleteUser(user.id)}
                        disabled={!canManageUsers || user.username === currentUsername}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={6}>No users match the current filters.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        {showCreateUserForm ? (
          <form className="form-grid bordered-top secondary-system-card" onSubmit={handleUserCreate}>
            <div className="full-width section-head compact-head">
              <div>
                <h3>Add user</h3>
                <p>Create a staff account and assign access in one step.</p>
              </div>
            </div>
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
            {hasVisibleStatusMessage ? (
              <div className="full-width inline-status-panel" role="status" aria-live="polite">
                {statusText}
              </div>
            ) : null}
          </form>
        ) : null}
        {showChangeOwnPinForm ? (
          <form className="form-grid bordered-top secondary-system-card" onSubmit={handleChangeOwnPin}>
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
          <form className="form-grid bordered-top secondary-system-card" onSubmit={handleRecoverPin}>
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
      </article>
    </section>
  );
}

export function SystemAttendanceSection(props: {
  attendance: AttendanceWorkspacePayload;
  attendanceDate: string;
  setAttendanceDate: Dispatch<SetStateAction<string>>;
  attendanceSettingsForm: AttendanceSettingsInput;
  setAttendanceSettingsForm: Dispatch<SetStateAction<AttendanceSettingsInput>>;
  handleAttendanceSettingsSave: FormEventHandler<HTMLFormElement>;
  canManageAttendanceSettings: boolean;
  formatDate: (value?: string | null) => string;
}) {
  const {
    attendance,
    attendanceDate,
    setAttendanceDate,
    attendanceSettingsForm,
    setAttendanceSettingsForm,
    handleAttendanceSettingsSave,
    canManageAttendanceSettings,
    formatDate,
  } = props;
  const [holidayDraft, setHolidayDraft] = useState({ date: "", label: "" });

  const weekdayOptions = [
    { value: 0, label: "Sunday" },
    { value: 1, label: "Monday" },
    { value: 2, label: "Tuesday" },
    { value: 3, label: "Wednesday" },
    { value: 4, label: "Thursday" },
    { value: 5, label: "Friday" },
    { value: 6, label: "Saturday" },
  ] as const;

  const toggleOffDay = (value: number) => {
    setAttendanceSettingsForm((current) => ({
      ...current,
      offDays: current.offDays.includes(value)
        ? current.offDays.filter((day) => day !== value)
        : [...current.offDays, value].sort((left, right) => left - right),
    }));
  };

  const addHoliday = () => {
    if (!holidayDraft.date || holidayDraft.label.trim().length < 2) {
      return;
    }

    setAttendanceSettingsForm((current) => ({
      ...current,
      holidays: [
        ...current.holidays.filter((entry) => entry.date !== holidayDraft.date),
        {
          date: holidayDraft.date,
          label: holidayDraft.label.trim(),
        },
      ].sort((left, right) => left.date.localeCompare(right.date)),
    }));
    setHolidayDraft({ date: "", label: "" });
  };

  const removeHoliday = (date: string) => {
    setAttendanceSettingsForm((current) => ({
      ...current,
      holidays: current.holidays.filter((entry) => entry.date !== date),
    }));
  };

  const formatTimestamp = (value?: string | null) =>
    value ? formatDate(value) : "-";

  const statusLabel = (
    status: AttendanceWorkspacePayload["entries"][number]["status"],
  ) => {
    if (status === "OFF_DAY") {
      return "Off day";
    }
    if (status === "HOLIDAY") {
      return "Holiday";
    }

    return status;
  };

  const statusTone = (status: AttendanceWorkspacePayload["entries"][number]["status"]) => {
    if (status === "CLOSED") {
      return "tag-good";
    }
    if (status === "ABSENT") {
      return "tag-critical";
    }
    if (status === "OFF_DAY" || status === "HOLIDAY") {
      return "tag-warn";
    }
    return "status-pill";
  };

  return (
    <section className="content-grid attendance-page-layout">
      <article className="surface-card workspace-table-card attendance-overview-card audit-match-card">
        <div className="section-head compact-head audit-match-head">
          <div>
            <h2>Attendance Register</h2>
            <p>Track staff login, activity, closing time, and day status.</p>
          </div>
        </div>
        <div className="audit-log-toolbar attendance-toolbar audit-match-toolbar">
          <label className="audit-log-search attendance-day-picker audit-match-search">
            <span>Date</span>
            <input
              type="date"
              value={attendanceDate}
              onChange={(event) => setAttendanceDate(event.target.value)}
            />
          </label>
          <div className="audit-log-metrics audit-match-metrics attendance-match-metrics">
            <div className="metric-mini audit-log-metric audit-match-metric">
              <span>Present</span>
              <strong>{attendance.summary.presentCount}</strong>
            </div>
            <div className="metric-mini audit-log-metric audit-match-metric">
              <span>Closed</span>
              <strong>{attendance.summary.closedCount}</strong>
            </div>
            <div className="metric-mini audit-log-metric audit-match-metric">
              <span>Absent</span>
              <strong>{attendance.summary.absentCount}</strong>
            </div>
            <div className="metric-mini audit-log-metric audit-match-metric">
              <span>Off / Holiday</span>
              <strong>
                {attendance.summary.offDayCount + attendance.summary.holidayCount}
              </strong>
            </div>
          </div>
        </div>
        {attendance.entries.length === 0 ? (
          <div className="chart-empty audit-log-empty-state">
            No active users are available for this attendance day.
          </div>
        ) : (
          <div className="audit-log-table-shell compact-scroll admin-table-shell audit-match-table-shell">
            <table className="audit-log-table admin-table audit-match-table">
              <thead>
                <tr>
                  <th>Staff</th>
                  <th>Status</th>
                  <th>Details</th>
                  <th>Opened</th>
                  <th>Last activity</th>
                  <th>Closed</th>
                </tr>
              </thead>
              <tbody>
                {attendance.entries.map((entry) => (
                  <tr key={`${attendance.date}-${entry.userId}`}>
                    <td>
                      <strong>{entry.displayName}</strong>
                      <div className="admin-table-subcopy">{entry.username}</div>
                    </td>
                    <td>
                      <div className="attendance-status-cell">
                        <span className={`audit-action-badge ${statusTone(entry.status)}`}>
                          {statusLabel(entry.status)}
                        </span>
                      </div>
                    </td>
                    <td>
                      <strong>{entry.role}</strong>
                      <div className="admin-table-subcopy">
                        {entry.status === "HOLIDAY"
                          ? entry.holidayLabel ?? "Holiday"
                          : entry.status === "OFF_DAY"
                            ? "Configured off day"
                            : entry.status === "ABSENT"
                              ? "No login activity"
                              : entry.status === "CLOSED"
                                ? "Closed for the day"
                                : "Currently open"}
                      </div>
                    </td>
                    <td>{formatTimestamp(entry.firstLoginAt)}</td>
                    <td>{formatTimestamp(entry.lastActivityAt)}</td>
                    <td>{formatTimestamp(entry.lastLogoutAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </article>

      <article className="surface-card form-card workspace-form-card attendance-calendar-card audit-match-card secondary-system-card">
        <div className="section-head compact-head audit-match-head">
          <div>
            <h2>Attendance Calendar</h2>
            <p>Configure off days and holiday dates used when absent staff are evaluated.</p>
          </div>
        </div>
        {!canManageAttendanceSettings ? (
          <div className="summary-panel full-width">
            <span>View only</span>
            <strong>Only the administrator can change attendance calendar settings</strong>
            <p className="muted-copy">
              Managers can monitor daily attendance here, but only the admin can
              change off days and holidays.
            </p>
          </div>
        ) : null}
        <form className="form-grid" onSubmit={handleAttendanceSettingsSave}>
          <div className="full-width">
            <span>Weekly off days</span>
            <div className="pill-filter-group attendance-weekday-row">
              {weekdayOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={`pill-filter${attendanceSettingsForm.offDays.includes(option.value) ? " active" : ""}`}
                  onClick={() => toggleOffDay(option.value)}
                  disabled={!canManageAttendanceSettings}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <div className="full-width section-head compact-head">
            <div>
              <h3>Holiday dates</h3>
              <p>Add the public holidays or special closures that should not count as absence.</p>
            </div>
          </div>
          <div className="attendance-holiday-row full-width">
            <label>
              <span>Date</span>
              <input
                type="date"
                value={holidayDraft.date}
                onChange={(event) =>
                  setHolidayDraft((current) => ({
                    ...current,
                    date: event.target.value,
                  }))
                }
                disabled={!canManageAttendanceSettings}
              />
            </label>
            <label>
              <span>Holiday name</span>
              <input
                value={holidayDraft.label}
                onChange={(event) =>
                  setHolidayDraft((current) => ({
                    ...current,
                    label: event.target.value,
                  }))
                }
                placeholder="Founders' Day, Independence Day..."
                disabled={!canManageAttendanceSettings}
              />
            </label>
            <button
              type="button"
              className="ghost-action attendance-holiday-add"
              onClick={addHoliday}
              disabled={!canManageAttendanceSettings}
            >
              Add holiday
            </button>
          </div>

          {attendanceSettingsForm.holidays.length > 0 ? (
            <div className="attendance-holiday-list full-width">
              {attendanceSettingsForm.holidays.map((holiday) => (
                <div key={holiday.date} className="attendance-holiday-item">
                  <div>
                    <strong>{holiday.label}</strong>
                    <div className="admin-table-subcopy">{holiday.date}</div>
                  </div>
                  <button
                    type="button"
                    className="ghost-action small"
                    onClick={() => removeHoliday(holiday.date)}
                    disabled={!canManageAttendanceSettings}
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="section-note full-width">
              No holidays have been configured yet.
            </p>
          )}

          <div className="full-width action-row">
            <button type="submit" disabled={!canManageAttendanceSettings}>
              Save attendance calendar
            </button>
          </div>
        </form>
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
      <article className="surface-card workspace-form-card audit-match-card alerts-compose-card">
        <div className="section-head audit-match-head">
          <div>
            <h2>Internal Alerts</h2>
            <p>Route internal bells quickly and keep active session alerts visible.</p>
          </div>
        </div>
        <div className="audit-log-metrics audit-match-metrics alerts-top-metrics">
          <div className="metric-mini audit-log-metric audit-match-metric">
            <span>Incoming alerts</span>
            <strong>{incomingAlerts.length}</strong>
          </div>
          <div className="metric-mini audit-log-metric audit-match-metric">
            <span>Queued notifications</span>
            <strong>{notificationItems.length}</strong>
          </div>
          <div className="metric-mini audit-log-metric audit-match-metric">
            <span>Queued recipients</span>
            <strong>{queuedRecipientCount}</strong>
          </div>
        </div>
        <div className="alerts-stack">
          <div className="surface-subpanel settings-subpanel alerts-compose-body">
            <InternalBellComposer
              bellForm={bellForm}
              setBellForm={setBellForm}
              bellRecipientOptions={bellRecipientOptions}
              handleBellSubmit={handleBellSubmit}
              title="Send internal bell"
              description="Target a staff member and deliver a short action-focused message."
            />
          </div>
          <div className="surface-subpanel settings-subpanel alerts-inbox-panel">
            <InternalBellInbox
              incomingAlerts={incomingAlerts}
              dismissIncomingAlert={dismissIncomingAlert}
              headingLevel="h3"
            />
          </div>
        </div>
      </article>

      <article className="surface-card workspace-table-card audit-match-card alerts-queue-card">
        <div className="section-head compact-head audit-match-head">
          <div>
            <h2>Notification Queue</h2>
            <p>Review outbound messages, statuses, and queue pressure from one workspace.</p>
          </div>
        </div>
        <div className="audit-log-toolbar audit-match-toolbar">
          <label className="audit-log-search audit-match-search">
            <span>Search queue</span>
            <input
              value={notificationSearchQuery}
              onChange={(event) => setNotificationSearchQuery(event.target.value)}
              placeholder="Search recipient, channel, status, or message"
            />
          </label>
          <div className="study-filter-row audit-log-filter-row audit-match-filter-row">
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
          <div className="audit-log-table-shell compact-scroll admin-table-shell audit-match-table-shell">
            <table className="audit-log-table admin-table audit-match-table alerts-queue-table">
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
                    <td>
                      <span className="audit-action-badge status-pill">{item.channel}</span>
                    </td>
                    <td>{item.recipient}</td>
                    <td>
                      <span className="audit-action-badge tag-warn">{item.status}</span>
                    </td>
                    <td>{item.message}</td>
                    <td>{formatDate(item.createdAt)}</td>
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

  const getActionTone = (action: string) => {
    if (/login|release|approve|restore|create|register/iu.test(action)) {
      return "tag-good";
    }
    if (/delete|reject|lock|purge|fail/iu.test(action)) {
      return "tag-critical";
    }
    if (/update|edit|reset|rotate|change|recover|dispatch/iu.test(action)) {
      return "tag-warn";
    }

    return "status-pill";
  };

  return (
    <section className="content-grid audit-log-layout">
      <article className="surface-card audit-log-card audit-match-card">
        <div className="section-head audit-match-head">
          <div>
            <h2>System Audit Logs</h2>
            <p>Track all significant system activities.</p>
          </div>
        </div>
        <div className="audit-log-toolbar audit-match-toolbar">
          <label className="audit-log-search audit-match-search">
            <span>Search activity</span>
            <input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search action, summary, trace code, or role"
            />
          </label>
          <div className="study-filter-row audit-log-filter-row audit-match-filter-row">
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
          <div className="audit-log-metrics audit-match-metrics">
            <div className="metric-mini audit-log-metric audit-match-metric">
              <span>Visible events</span>
              <strong>{filteredAuditTrail.length}</strong>
            </div>
            <div className="metric-mini audit-log-metric audit-match-metric">
              <span>Actions covered</span>
              <strong>{visibleActionCount}</strong>
            </div>
            <div className="metric-mini audit-log-metric audit-match-metric">
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
          <div className="audit-log-table-shell compact-scroll audit-log-list audit-match-table-shell">
            <table className="audit-log-table audit-match-table">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Action</th>
                  <th>Details</th>
                  <th>Performed by</th>
                </tr>
              </thead>
              <tbody>
                {filteredAuditTrail.map((entry, index) => (
                  <tr key={`${entry.createdAt}-${entry.action}-${index}`}>
                    <td>{formatDate(entry.createdAt)}</td>
                    <td>
                      <span className={`audit-action-badge ${getActionTone(entry.action)}`}>
                        {entry.action}
                      </span>
                    </td>
                    <td>
                      <strong>{entry.summary}</strong>
                      <div className="admin-table-subcopy">
                        {[entry.entityType, entry.traceCode].filter(Boolean).join(" · ") || "System event"}
                      </div>
                    </td>
                    <td>{entry.role}</td>
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
  statusText: string;
  ownProfileForm: OwnProfileInput;
  setOwnProfileForm: Dispatch<SetStateAction<OwnProfileInput>>;
  currentUserRole: string;
  currentUsername: string;
  currentDisplayName: string;
  currentPinChangedAt?: string | null;
  currentLastLoginAt?: string | null;
  handleOwnProfileSave: FormEventHandler<HTMLFormElement>;
  selfPinChange: ChangeOwnPinInput;
  setSelfPinChange: Dispatch<SetStateAction<ChangeOwnPinInput>>;
  handleChangeOwnPin: FormEventHandler<HTMLFormElement>;
  passwordVisibility: PasswordVisibilityState;
  togglePasswordVisibility: (
    field:
      | "userCreate"
      | "recoverPin"
      | "selfCurrentPin"
      | "selfNewPin",
  ) => void;
  formatDate: (value?: string | null) => string;
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
    statusText,
    ownProfileForm,
    setOwnProfileForm,
    currentUserRole,
    currentUsername,
    currentDisplayName,
    currentPinChangedAt,
    currentLastLoginAt,
    handleOwnProfileSave,
    selfPinChange,
    setSelfPinChange,
    handleChangeOwnPin,
    passwordVisibility,
    togglePasswordVisibility,
    formatDate,
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
  const hasVisibleStatusMessage =
    statusText !== "Ready to connect" && statusText !== "Signed out";

  return (
    <section className="content-grid admin-workspace-layout settings-workspace-layout">
      <article className="surface-card form-card workspace-form-card settings-profile-card audit-match-card settings-card-shell">
        <div className="section-head audit-match-head">
          <div>
            <h2>My Account</h2>
            <p>Update your sign-in details and rotate your PIN from this workspace.</p>
          </div>
        </div>
        <div className="audit-log-metrics audit-match-metrics settings-top-metrics">
          <div className="metric-mini audit-log-metric audit-match-metric">
            <span>Role</span>
            <strong>{currentUserRole}</strong>
          </div>
          <div className="metric-mini audit-log-metric audit-match-metric">
            <span>Last login</span>
            <strong>{formatDate(currentLastLoginAt)}</strong>
          </div>
          <div className="metric-mini audit-log-metric audit-match-metric">
            <span>PIN updated</span>
            <strong>{formatDate(currentPinChangedAt)}</strong>
          </div>
        </div>
        <form className="form-grid bordered-top settings-card-body" onSubmit={handleOwnProfileSave}>
          <label>
            <span>Display name</span>
            <input
              value={ownProfileForm.displayName}
              onChange={(event) =>
                setOwnProfileForm((current) => ({
                  ...current,
                  displayName: event.target.value,
                }))
              }
            />
          </label>
          <label>
            <span>Username</span>
            <input
              value={ownProfileForm.username}
              onChange={(event) =>
                setOwnProfileForm((current) => ({
                  ...current,
                  username: event.target.value,
                }))
              }
            />
          </label>
          <div className="summary-panel full-width">
            <span>Current identity</span>
            <strong>{currentDisplayName || currentUsername}</strong>
            <p className="muted-copy">
              Usernames are lowercase and unique. Role changes remain admin-only.
            </p>
          </div>
          <div className="full-width action-row">
            <button type="submit">Save account details</button>
          </div>
        </form>
        <form className="form-grid bordered-top settings-card-body" onSubmit={handleChangeOwnPin}>
          <div className="full-width section-head compact-head">
            <div>
              <h3>Change PIN</h3>
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
          {hasVisibleStatusMessage ? (
            <div className="full-width inline-status-panel" role="status" aria-live="polite">
              {statusText}
            </div>
          ) : null}
        </form>
      </article>

      <article className="surface-card form-card workspace-form-card settings-profile-card audit-match-card settings-card-shell">
        <div className="section-head audit-match-head">
          <div>
            <h2>Facility Profile</h2>
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
        <form className="form-grid settings-card-body" onSubmit={handleFacilitySave}>
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

      <article className="surface-card workspace-table-card settings-operations-card audit-match-card settings-card-shell">
        <div className="section-head compact-head audit-match-head">
          <div>
            <h2>Data Management</h2>
            <p>Backups, restore operations, and integration runtime controls.</p>
          </div>
        </div>
        <div className="audit-log-metrics audit-match-metrics settings-top-metrics">
          <div className="metric-mini audit-log-metric audit-match-metric">
            <span>Backup snapshots</span>
            <strong>{backups.length}</strong>
          </div>
          <div className="metric-mini audit-log-metric audit-match-metric">
            <span>Restored snapshots</span>
            <strong>{restoredBackupCount}</strong>
          </div>
          <div className="metric-mini audit-log-metric audit-match-metric">
            <span>Pending dispatches</span>
            <strong>{syncStatus.pending}</strong>
          </div>
        </div>
        <div className="system-action-row admin-table-actions settings-action-stack">
          <input
            ref={backupImportInputRef}
            type="file"
            accept=".enc,text/plain,application/octet-stream"
            onChange={handleBackupImport}
            hidden
          />
          <button
            type="button"
            className="primary-action settings-wide-action"
            onClick={handleBackupCreate}
            disabled={!canManageBackups}
          >
            Create backup
          </button>
          <button
            type="button"
            className="ghost-action settings-wide-action"
            onClick={handleBackupExport}
            disabled={!canManageBackups || !selectedBackupId}
          >
            Export backup
          </button>
          <button
            type="button"
            className="primary-action settings-wide-action settings-restore-action"
            onClick={handleBackupImportPrompt}
            disabled={!canManageBackups}
          >
            Import backup
          </button>
          <button
            type="button"
            className="ghost-action settings-wide-action"
            onClick={handleRestoreLatest}
            disabled={!canManageBackups || !selectedBackupId}
          >
            Restore backup
          </button>
          <button
            type="button"
            className="ghost-action settings-wide-action"
            onClick={handleRunIntegrationDispatch}
            disabled={!canManageIntegrations}
          >
            Run dispatch
          </button>
        </div>
        <div className="admin-split-panels settings-split-panels settings-card-body">
          <div className="surface-subpanel settings-subpanel">
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
          <div className="surface-subpanel settings-subpanel settings-runtime-panel">
            <div className="section-head compact-head">
              <div>
                <h3>Runtime status</h3>
                <p>Integration throughput, worker cadence, and dispatch health.</p>
              </div>
            </div>
            <div className="mini-status-grid settings-runtime-grid">
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
