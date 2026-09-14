"use client";

import { Button, Input, Modal, Switch, useOverlayState } from "@heroui/react";
import { Check, CircleAlert, LoaderCircle, Trash2, UserPlus } from "lucide-react";
import { useState } from "react";

const emptyMember = () => ({
  name: "", email: "", phone: "", roll_no: "", hostel: "", branch: "", year: "", role: "member", attendance: false,
});

const memberFields = [
  ["name", "Full name"], ["email", "Email"], ["phone", "Phone"], ["roll_no", "Roll number"],
  ["hostel", "Hostel"], ["branch", "Branch"], ["year", "Year"],
];

export default function TeamEditor({ team, onClose, onSaved }) {
  const modalState = useOverlayState({
    defaultOpen: true,
    onOpenChange: (isOpen) => { if (!isOpen) onClose(); },
  });
  const [draft, setDraft] = useState({ ...team, members: team.members.map((member) => ({ ...member })) });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

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
      const response = await fetch("/api/teams/" + team.id, {
        method: "PATCH",
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

  return (
    <Modal state={modalState}>
      <Modal.Backdrop variant="blur" className="editor-backdrop">
        <Modal.Container scroll="inside" className="editor-container">
          <Modal.Dialog className="editor-modal">
            <Modal.Header className="modal-heading editor-modal-heading">
              <div>
                <span className="eyebrow">TEAM CONFIGURATION</span>
                <Modal.Heading className="editor-title">Edit #{team.id}</Modal.Heading>
              </div>
              <Modal.CloseTrigger className="icon-button" aria-label="Close team editor" />
            </Modal.Header>
            <Modal.Body className="editor-modal-body">
              <label className="field-label">
                TEAM NAME
                <Input variant="secondary" value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} />
              </label>
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
                        <Button isIconOnly variant="ghost" className="remove-member" aria-label={"Remove " + member.name} disabled={draft.members.length === 1} onPress={() => removeMember(index)}>
                          <Trash2 size={16} />
                        </Button>
                      </div>
                    </div>
                    <div className="field-grid">
                      {memberFields.map(([key, label]) => (
                        <label className="field-label" key={key}>
                          {label}
                          <Input variant="secondary" value={member[key] || ""} onChange={(event) => updateMember(index, key, event.target.value)} />
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
              <Button variant="ghost" className="cancel-button" onPress={modalState.close}>Cancel</Button>
              <Button variant="primary" className="primary-button" onPress={save} isDisabled={saving}>
                {saving ? <LoaderCircle className="spin" size={17} /> : <Check size={17} />} Save changes
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
