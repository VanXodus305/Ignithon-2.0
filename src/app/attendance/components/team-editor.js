"use client";

import { Button, Input, ListBox, Modal, Select, Switch, useOverlayState } from "@heroui/react";
import { Check, CircleAlert, LoaderCircle, Trash2, UserPlus } from "lucide-react";
import { useState } from "react";

const emptyMember = () => ({
  name: "", email: "", phone: "", roll_no: "", hostel: "", branch: "", year: "", role: "member", attendance: false,
});

const memberFields = [
  ["name", "Full name"], ["email", "Email"], ["phone", "Phone"], ["roll_no", "Roll number"],
  ["hostel", "Hostel"], ["branch", "Branch"], ["year", "Year"],
];
const branchOptions = ["Information Technology", "Computer Science", "Electronics & Computer Science", "Mechanical Engineering", "Other"];
const yearOptions = [
  { value: "1", label: "1st Year" },
  { value: "2", label: "2nd Year" },
  { value: "3", label: "3rd Year" },
  { value: "4", label: "4th Year" },
  { value: "5", label: "5th Year" },
];

function DropdownField({ value, onChange, placeholder, options, ariaLabel }) {
  return (
    <Select fullWidth selectedKey={value || null} onSelectionChange={(key) => onChange(key ? String(key) : "")}>
      <Select.Trigger className="field-select">
        <Select.Value>{({ defaultChildren }) => defaultChildren || placeholder}</Select.Value>
        <Select.Indicator />
      </Select.Trigger>
      <Select.Popover><ListBox aria-label={ariaLabel}>{options.map(({ value: optionValue, label }) => <ListBox.Item id={optionValue} key={optionValue}>{label}</ListBox.Item>)}</ListBox></Select.Popover>
    </Select>
  );
}

export default function TeamEditor({ team, onClose, onSaved, onDeleteTeam }) {
  const isNew = !team;
  const initialTeam = team || { name: "", room: null, members: [{ ...emptyMember(), role: "leader" }] };
  const modalState = useOverlayState({
    defaultOpen: true,
    onOpenChange: (isOpen) => { if (!isOpen) onClose(); },
  });
  const [draft, setDraft] = useState({ ...initialTeam, members: initialTeam.members.map((member) => ({ ...member })) });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [confirmation, setConfirmation] = useState(null);
  const confirmState = useOverlayState({ isOpen: Boolean(confirmation), onOpenChange: (isOpen) => { if (!isOpen) setConfirmation(null); } });

  const updateMember = (index, key, value) => setDraft((current) => ({
    ...current,
    members: current.members.map((member, memberIndex) => memberIndex === index ? { ...member, [key]: value } : member),
  }));
  const makeLeader = (index) => setDraft((current) => ({
    ...current,
    members: current.members.map((member, memberIndex) => ({ ...member, role: memberIndex === index ? "leader" : "member" })),
  }));
  const removeMember = (index) => setDraft((current) => ({
    ...current,
    members: current.members.filter((_, memberIndex) => memberIndex !== index),
  }));

  async function save() {
    setSaving(true);
    setError("");
    try {
      const response = await fetch(isNew ? "/api/teams" : "/api/teams/" + team.id, {
        method: isNew ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      onSaved(data.team);
      modalState.close();
    } catch (saveError) {
      setError(saveError.message || "Could not save the team.");
    } finally {
      setSaving(false);
    }
  }

  async function confirmDeletion() {
    if (confirmation.type === "member") removeMember(confirmation.index);
    else {
      try {
        await onDeleteTeam();
        modalState.close();
      } catch (deleteError) {
        setError(deleteError.message || "Could not delete the team.");
      }
    }
    setConfirmation(null);
  }

  return (
    <>
    <Modal state={modalState}>
      <Modal.Backdrop variant="blur" className="editor-backdrop">
        <Modal.Container scroll="inside" className="editor-container">
          <Modal.Dialog className="editor-modal">
            <Modal.Header className="modal-heading editor-modal-heading">
              <div>
                <span className="eyebrow">TEAM CONFIGURATION</span>
                <Modal.Heading className="editor-title">{isNew ? "Create team" : "Edit #" + team.id}</Modal.Heading>
              </div>
              <Modal.CloseTrigger className="icon-button" aria-label="Close team editor" />
            </Modal.Header>
            <Modal.Body className="editor-modal-body">
              <label className="field-label">
                TEAM NAME
                <Input variant="secondary" value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} />
              </label>
              {!isNew && <label className="field-label room-field">
                ROOM
                <DropdownField value={draft.room} onChange={(room) => setDraft({ ...draft, room })} placeholder="Unassigned" ariaLabel="Team room" options={[{ value: "A", label: "Room A" }, { value: "B", label: "Room B" }, { value: "C", label: "Room C" }]} />
              </label>}
              <p className="editor-note">Choose one leader. They are always stored first in the roster.</p>
              <div className="editor-members">
                {draft.members.map((member, index) => (
                  <section className="editor-member" key={member._id || index}>
                    <div className="editor-member-bar">
                      <strong>PARTICIPANT {index + 1}</strong>
                      <div className="editor-member-actions">
                        <Switch size="sm" className="leader-switch" isSelected={member.role === "leader"} onChange={(isSelected) => { if (isSelected) makeLeader(index); }}>
                          <Switch.Content><Switch.Control><Switch.Thumb /></Switch.Control><span>Team leader</span></Switch.Content>
                        </Switch>
                        <Button isIconOnly variant="ghost" className="remove-member" aria-label={"Remove " + member.name} disabled={draft.members.length === 1} onPress={() => setConfirmation({ type: "member", index, name: member.name })}>
                          <Trash2 size={16} />
                        </Button>
                      </div>
                    </div>
                    <div className="field-grid">
                      {memberFields.map(([key, label]) => (
                        <label className="field-label" key={key}>
                          {label}
                          {key === "branch" ? <DropdownField value={member.branch} onChange={(value) => updateMember(index, key, value)} placeholder="Select branch" ariaLabel="Branch" options={[...(member.branch && !branchOptions.includes(member.branch) ? [{ value: member.branch, label: member.branch }] : []), ...branchOptions.map((option) => ({ value: option, label: option }))]} /> : key === "year" ? <DropdownField value={member.year ? String(member.year) : ""} onChange={(value) => updateMember(index, key, value)} placeholder="Select year" ariaLabel="Year" options={yearOptions} /> : <Input variant="secondary" value={member[key] || ""} onChange={(event) => updateMember(index, key, event.target.value)} />}
                        </label>
                      ))}
                    </div>
                  </section>
                ))}
              </div>
              {draft.members.length < 4 && (
                <Button variant="ghost" className="add-member" onPress={() => setDraft({ ...draft, members: [...draft.members, emptyMember()] })}>
                  <UserPlus size={16} /> Add participant
                </Button>
              )}
              {error && <p className="form-error"><CircleAlert size={16} />{error}</p>}
            </Modal.Body>
            <Modal.Footer className="modal-actions">
              {!isNew && <Button variant="ghost" className="remove-member" onPress={() => setConfirmation({ type: "team" })}><Trash2 size={16} /> Delete team</Button>}
              <Button variant="ghost" className="cancel-button" onPress={modalState.close}>Cancel</Button>
              <Button variant="primary" className="primary-button" onPress={save} isDisabled={saving}>
                {saving ? <LoaderCircle className="spin" size={17} /> : <Check size={17} />} Save changes
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
    <Modal state={confirmState}>
      <Modal.Backdrop variant="blur">
        <Modal.Container><Modal.Dialog className="confirmation-modal">
          <Modal.Header><Modal.Heading>{confirmation?.type === "team" ? "Delete team?" : "Remove participant?"}</Modal.Heading></Modal.Header>
          <Modal.Body><p>{confirmation?.type === "team" ? "This permanently deletes the team and every participant in it." : `Remove ${confirmation?.name} from this team? Their participant record will be permanently deleted when changes are saved.`}</p></Modal.Body>
          <Modal.Footer><Button variant="ghost" onPress={() => setConfirmation(null)}>Cancel</Button><Button variant="danger" onPress={confirmDeletion}>Delete</Button></Modal.Footer>
        </Modal.Dialog></Modal.Container>
      </Modal.Backdrop>
    </Modal>
    </>
  );
}
