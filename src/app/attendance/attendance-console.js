"use client";

import { Button, Input } from "@heroui/react";
import {
  Camera,
  ChevronRight,
  CircleAlert,
  Edit3,
  QrCode,
  Search,
  Users,
  X,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import CameraScannerModal from "./components/camera-scanner-modal";
import MemberCard from "./components/member-card";
import TeamEditor from "./components/team-editor";

export default function AttendanceConsole() {
  const [team, setTeam] = useState(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [camera, setCamera] = useState(false);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState(
    "Ready for scanner input. Scan any participant QR code to load their team.",
  );
  const scanBuffer = useRef("");
  const scanTimer = useRef();
  const scanner = useRef();
  const searchRequest = useRef();
  const searchCache = useRef(new Map());
  const cameraClosing = useRef(false);

  const loadQr = useCallback(async (code) => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(
        "/api/attendance?qr=" + encodeURIComponent(code),
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setTeam({
        ...data.team,
        members: data.team.members.map((member) =>
          member._id === data.scannedParticipantId
            ? { ...member, attendance: true }
            : member,
        ),
      });
      setMessage(
        "QR verified · " +
          data.team.name +
          " · participant selected for attendance",
      );
      await fetch("/api/attendance", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          participantId: data.scannedParticipantId,
          attendance: true,
        }),
      });
    } catch (loadError) {
      setError(loadError.message || "Could not read that QR code.");
    } finally {
      setLoading(false);
    }
  }, []);

  const stopCamera = useCallback(async () => {
    const activeScanner = scanner.current;
    scanner.current = null;
    if (!activeScanner) return;
    try {
      if (activeScanner.isScanning) await activeScanner.stop();
    } catch {}
    try {
      await activeScanner.clear();
    } catch {}
  }, []);

  useEffect(() => {
    const listener = (event) => {
      if (event.key === "Enter" && scanBuffer.current.includes("|")) {
        loadQr(scanBuffer.current);
        scanBuffer.current = "";
      } else if (event.key.length === 1) {
        scanBuffer.current += event.key;
        clearTimeout(scanTimer.current);
        scanTimer.current = setTimeout(() => {
          scanBuffer.current = "";
        }, 180);
      }
    };
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, [loadQr]);

  useEffect(() => {
    let cancelled = false;
    let localScanner;
    async function start() {
      if (!camera) return;
      try {
        const { Html5Qrcode } = await import("html5-qrcode");
        if (cancelled) return;
        localScanner = new Html5Qrcode("camera-reader");
        scanner.current = localScanner;
        await localScanner.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 230, height: 230 } },
          async (text) => {
            if (cameraClosing.current) return;
            cameraClosing.current = true;
            await stopCamera();
            setCamera(false);
            loadQr(text);
          },
          () => {},
        );
      } catch {
        if (!cancelled) {
          setError("Camera access could not start. Check browser permission.");
          await stopCamera();
          setCamera(false);
        }
      }
    }
    start();
    return () => {
      cancelled = true;
      if (scanner.current === localScanner) stopCamera();
    };
  }, [camera, loadQr, stopCamera]);

  useEffect(() => {
    const timer = setTimeout(async () => {
      const normalized = query.trim().toLowerCase();
      if (!normalized) return setResults([]);
      if (searchCache.current.has(normalized))
        return setResults(searchCache.current.get(normalized));
      searchRequest.current?.abort();
      const controller = new AbortController();
      searchRequest.current = controller;
      try {
        const response = await fetch(
          "/api/attendance?q=" + encodeURIComponent(normalized),
          { signal: controller.signal },
        );
        const data = await response.json();
        if (!response.ok)
          throw new Error(data.error || "Search could not be completed.");
        const nextResults = data.teams || [];
        searchCache.current.set(normalized, nextResults);
        if (searchCache.current.size > 30)
          searchCache.current.delete(searchCache.current.keys().next().value);
        setResults(nextResults);
      } catch (searchError) {
        if (searchError.name !== "AbortError") {
          setResults([]);
          setError(searchError.message || "Search could not be completed.");
        }
      }
    }, 350);
    return () => {
      clearTimeout(timer);
      searchRequest.current?.abort();
    };
  }, [query]);

  async function toggle(member) {
    const attendance = !member.attendance;
    setTeam((current) => ({
      ...current,
      members: current.members.map((item) =>
        item._id === member._id ? { ...item, attendance } : item,
      ),
    }));
    const response = await fetch("/api/attendance", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ participantId: member._id, attendance }),
    });
    if (!response.ok) {
      setError("Attendance update failed. Please retry.");
      setTeam((current) => ({
        ...current,
        members: current.members.map((item) =>
          item._id === member._id ? { ...item, attendance: !attendance } : item,
        ),
      }));
    }
  }

  function openTeam(selected) {
    setTeam(selected);
    setResults([]);
    setQuery("");
    setMessage("Team #" + selected.id + " loaded from manual search.");
  }

  return (
    <main className="portal-shell">
      <section className="portal-card">
        <header className="portal-header">
          <div className="brand">
            <span className="brand-mark">↗</span>
            <div>
              <b>IGNITHON</b>
              <small>2.0 · OC COMMAND</small>
            </div>
          </div>
          <div className="header-state">
            <span className="live-dot" /> ATTENDANCE DESK
          </div>
        </header>
        <div className="intro">
          <div>
            <span className="eyebrow">CHECK-IN CONTROL</span>
            <h1>
              ATTENDANCE <em>TERMINAL</em>
            </h1>
            <p>Scan a credential or locate a team manually.</p>
          </div>
        </div>
        <div className="control-deck">
          <div className="scan-guide">
            <div className="scan-icon">
              <QrCode size={25} />
            </div>
            <div>
              <b>Physical QR scanner</b>
              <p>
                Keep this page active, then scan. Scanner input is detected
                automatically.
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            className="camera-button"
            onPress={() => {
              cameraClosing.current = false;
              setCamera(true);
            }}
          >
            <Camera size={19} />
            <span>Use phone camera</span>
          </Button>
        </div>
        <div className="search-wrap">
          <Search size={19} />
          <Input
            variant="secondary"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search team using any details"
          />
          {query && (
            <Button
              isIconOnly
              variant="ghost"
              onPress={() => {
                setQuery("");
                setResults([]);
              }}
              aria-label="Clear search"
            >
              <X size={17} />
            </Button>
          )}
          {results.length > 0 && (
            <div className="search-results">
              <div className="search-results-heading">
                <span>Matching teams</span>
                <span>{results.length}</span>
              </div>
              {results.map((result) => (
                <Button
                  key={result._id}
                  variant="ghost"
                  className="search-result-button"
                  onPress={() => openTeam(result)}
                >
                  <span className="search-result-id">#{result.id}</span>
                  <span className="search-result-copy">
                    <b>{result.name}</b>
                    <small>
                      <Users size={13} /> {result.members.length}{" "}
                      {result.members.length === 1 ? "member" : "members"}
                    </small>
                  </span>
                  <ChevronRight size={17} />
                </Button>
              ))}
            </div>
          )}
        </div>
        {(error || message) && (
          <div className={error ? "notice error-notice" : "notice"}>
            {error ? <CircleAlert size={17} /> : <span className="live-dot" />}
            {error || message}
          </div>
        )}
        {team ? (
          <section className="team-panel">
            <div className="team-panel-head">
              <div>
                <span className="eyebrow">ACTIVE TEAM</span>
                <h2>{team.name}</h2>
                <p>
                  <b>#{team.id}</b> ·{" "}
                  {team.members.filter((member) => member.attendance).length}/
                  {team.members.length} PRESENT
                </p>
              </div>
              <Button
                variant="outline"
                className="outline-button edit-button"
                onPress={() => setEditing(true)}
              >
                <Edit3 size={16} /> Edit team
              </Button>
            </div>
            <div className="members-grid">
              {team.members.map((member, index) => (
                <MemberCard
                  key={member._id}
                  member={member}
                  index={index + 1}
                  onToggle={toggle}
                />
              ))}
            </div>
          </section>
        ) : (
          <section className="empty-stage">
            <Users size={30} />
            <h2>Awaiting a team</h2>
            <p>Scan a participant credential or search to begin attendance.</p>
          </section>
        )}
      </section>
      {camera && (
        <CameraScannerModal
          onClose={async () => {
            cameraClosing.current = true;
            await stopCamera();
            setCamera(false);
          }}
        />
      )}
      {editing && (
        <TeamEditor
          team={team}
          onClose={() => setEditing(false)}
          onSaved={(updated) => {
            setTeam(updated);
            setMessage("Team details updated successfully.");
          }}
        />
      )}
      {loading && <span className="sr-only">Loading scanned team</span>}
    </main>
  );
}
