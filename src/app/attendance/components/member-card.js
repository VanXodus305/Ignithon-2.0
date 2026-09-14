"use client";

import { Button } from "@heroui/react";
import { Check, Circle } from "lucide-react";

export default function MemberCard({ member, index, onToggle }) {
  return (
    <article className={"member-card " + (member.attendance ? "member-present" : "")}>
      <div className="member-card-top">
        <span className={"role-pill " + (member.role === "leader" ? "leader" : "")}>
          {member.role === "leader" ? "TEAM LEADER" : "MEMBER " + index}
        </span>
        <span className="member-index">{String(index).padStart(2, "0")}</span>
      </div>
      <h3>{member.name}</h3>
      {member.email && (
        <p>
          <a className="contact-link" href={`mailto:${member.email}`}>
            {member.email}
          </a>
        </p>
      )}
      {member.roll_no && <p><strong>Roll:</strong> {member.roll_no}</p>}
      {member.phone && (
        <p>
          <a className="contact-link" href={`tel:${String(member.phone).replace(/[^\d+]/g, "")}`}>
            <strong>Phone:</strong> {member.phone}
          </a>
        </p>
      )}
      {!member.roll_no && !member.phone && <p>No contact details</p>}
      <Button
        variant="outline"
        className={"attendance-toggle " + (member.attendance ? "checked" : "")}
        onPress={() => onToggle(member)}
      >
        {member.attendance ? <Check size={17} /> : <Circle size={17} />}
        {member.attendance ? "Present" : "Mark present"}
      </Button>
    </article>
  );
}
