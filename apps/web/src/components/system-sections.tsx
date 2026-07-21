import {
  type AdminOverviewPayload,
  type AdminUserInput,
  type AdminUserSummaryPayload,
  type FacilitySettingsInput,
  type IntegrationDispatchStatusPayload,
  type InternalAlertPayload,
  type UserDirectoryEntryPayload,
  userRoles,
} from "@medilab/shared";
import type {
  ChangeEventHandler,
  Dispatch,
  FormEventHandler,
  SetStateAction,
} from "react";

type BackupRecord = {
  id: string;
  label: string;
  createdAt: string;
  restoredAt?: string | null;
  encrypted: boolean;
};

type PinRotationState = {
  userId: string;
  newPin: string;
};

type PasswordVisibilityState = {
  userCreate: boolean;
  rotatePin: boolean;
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
        <p className="muted-copy">No active internal alerts for you right now.</p>
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
  userForm: AdminUserInput;
  setUserForm: Dispatch<SetStateAction<AdminUserInput>>;
  passwordVisibility: PasswordVisibilityState;
  togglePasswordVisibility: (field: "userCreate" | "rotatePin") => void;
  handleUserCreate: FormEventHandler<HTMLFormElement>;
  pinRotation: PinRotationState;
  setPinRotation: Dispatch<SetStateAction<PinRotationState>>;
  handleRotatePin: FormEventHandler<HTMLFormElement>;
  users: AdminUserSummaryPayload[];
  formatDate: (value?: string | null) => string;
  handleToggleUser: (userId: string, isActive: boolean) => void;
  handleUnlockUser: (userId: string) => void;
}) {
  const {
    canManageUsers,
    userForm,
    setUserForm,
    passwordVisibility,
    togglePasswordVisibility,
    handleUserCreate,
    pinRotation,
    setPinRotation,
    handleRotatePin,
    users,
    formatDate,
    handleToggleUser,
    handleUnlockUser,
  } = props;

  return (
    <section className="content-grid two-wide">
      <article className="surface-card form-card">
        <div className="section-head">
          <div>
            <h2>Users and access</h2>
            <p>Create accounts, rotate PINs, and reset lockouts.</p>
          </div>
        </div>
        <form className="form-grid" onSubmit={handleUserCreate}>
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
        <form className="form-grid bordered-top" onSubmit={handleRotatePin}>
          <label>
            <span>User</span>
            <select
              value={pinRotation.userId}
              onChange={(event) =>
                setPinRotation((current) => ({
                  ...current,
                  userId: event.target.value,
                }))
              }
              disabled={!canManageUsers}
            >
              <option value="">Choose user</option>
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.username}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>New PIN</span>
            <div className="password-field">
              <input
                type={passwordVisibility.rotatePin ? "text" : "password"}
                value={pinRotation.newPin}
                onChange={(event) =>
                  setPinRotation((current) => ({
                    ...current,
                    newPin: event.target.value,
                  }))
                }
                disabled={!canManageUsers}
              />
              <button
                type="button"
                className="field-action-button"
                onClick={() => togglePasswordVisibility("rotatePin")}
              >
                {passwordVisibility.rotatePin ? "Hide" : "Show"}
              </button>
            </div>
          </label>
          <div className="full-width action-row">
            <button type="submit" disabled={!canManageUsers}>
              Rotate PIN
            </button>
          </div>
        </form>
      </article>

      <article className="surface-card">
        <div className="section-head">
          <div>
            <h2>User directory</h2>
            <p>Activate, deactivate, unlock, and review account status.</p>
          </div>
        </div>
        <div className="list-stack compact-scroll">
          {users.map((user) => (
            <div key={user.id} className="list-row user-admin-row">
              <div>
                <strong>{user.displayName}</strong>
                <span>
                  {user.username} · {user.role}
                </span>
                <small>
                  {user.lockedUntil
                    ? `Locked until ${formatDate(user.lockedUntil)}`
                    : `PIN changed ${formatDate(user.pinChangedAt)}`}
                </small>
              </div>
              <div className="inline-actions">
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
            </div>
          ))}
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

  return (
    <section className="content-grid two-wide">
      <article className="surface-card form-card">
        <InternalBellComposer
          bellForm={bellForm}
          setBellForm={setBellForm}
          bellRecipientOptions={bellRecipientOptions}
          handleBellSubmit={handleBellSubmit}
          title="Internal alerts"
          description="Send an internal bell and review alerts that reached this session."
        />
      </article>

      <article className="surface-card">
        <InternalBellInbox
          incomingAlerts={incomingAlerts}
          dismissIncomingAlert={dismissIncomingAlert}
        />
        <div className="bordered-top">
          <div className="section-head compact-head">
            <div>
              <h3>Queued notifications</h3>
              <p>Outbound notices waiting in the system queue.</p>
            </div>
          </div>
          <div className="list-stack compact-scroll">
            {notificationItems.length === 0 ? (
              <div className="list-row">
                <span>No queued notifications.</span>
                <small>Notification queue is clear.</small>
              </div>
            ) : null}
            {notificationItems.map((item, index) => (
              <div
                key={`${item.recipient}-${item.createdAt}-${index}`}
                className="list-row user-admin-row"
              >
                <div>
                  <strong>{item.channel}</strong>
                  <span>
                    {item.recipient} · {item.status}
                  </span>
                  <small>{item.message}</small>
                </div>
                <small>{formatDate(item.createdAt)}</small>
              </div>
            ))}
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

  return (
    <section className="content-grid two-wide">
      <article className="surface-card">
        <div className="section-head">
          <div>
            <h2>System Audit Logs</h2>
            <p>Track all significant system activities.</p>
          </div>
        </div>
        <div className="list-stack compact-scroll">
          {auditTrail.length === 0 ? (
            <div className="list-row">
              <span>No audit events available.</span>
              <small>Activity will appear here as users work.</small>
            </div>
          ) : null}
          {auditTrail.map((entry, index) => (
            <div
              key={`${entry.createdAt}-${entry.action}-${index}`}
              className="list-row user-admin-row"
            >
              <div>
                <strong>{entry.action}</strong>
                <span>
                  {entry.entityType}
                  {entry.traceCode ? ` · ${entry.traceCode}` : ""}
                </span>
                <small>{entry.summary}</small>
              </div>
              <small>
                {formatDate(entry.createdAt)} · {entry.role}
              </small>
            </div>
          ))}
        </div>
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
  logoSrc: string;
  fallbackFacilityName: string;
  canManageBackups: boolean;
  canManageIntegrations: boolean;
  handleBackupCreate: () => void;
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
    logoSrc,
    fallbackFacilityName,
    canManageBackups,
    canManageIntegrations,
    handleBackupCreate,
    handleRestoreLatest,
    handleRunIntegrationDispatch,
    selectedBackupId,
    setSelectedBackupId,
    backups,
    syncStatus,
  } = props;

  return (
    <section className="content-grid two-wide">
      <article className="surface-card form-card">
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
              Reception can view the facility details here, but only the
              manager or admin can change them.
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
                  {[facilityForm.location, facilityForm.phone, facilityForm.email]
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
            <button type="submit" disabled={!canManageUsers}>
              Save facility profile
            </button>
          </div>
        </form>
      </article>

      <article className="surface-card">
        <div className="section-head">
          <div>
            <h2>System operations</h2>
            <p>Backups, integration dispatch, and runtime health.</p>
          </div>
        </div>
        <div className="system-action-row">
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
            onClick={handleRestoreLatest}
            disabled={!canManageBackups}
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
      </article>
    </section>
  );
}