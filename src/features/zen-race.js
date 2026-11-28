(function (root) {
  'use strict';

  const api = root.__TWFOX_TETRIO__;
  if (!api) return;

  const internals = (root.__TWFOX_INTERNAL__ = root.__TWFOX_INTERNAL__ || {});
  const raceLogic = internals.raceLogic;
  const p2pRoom = internals.p2pRoom;
  const foxmodCanvas = internals.foxmodCanvas;
  const quickPlayLogic = internals.quickPlayLogic;
  const foxInviteLogic = internals.foxInviteLogic;
  if (!raceLogic) return;

  const STYLE_ID = 'twfoxtetrio-zen-race-style';
  const CARD_ID = 'twfoxtetrio-zenith-race-card';
  const INFO_ID = 'twfoxtetrio-zenith-race-info';
  const PARTY_ID = 'twfoxtetrio-race-party';
  const DOCK_ID = 'twfoxtetrio-race-dock';
  const SPECTATOR_ID = 'twfoxtetrio-race-spectator';
  const RESULTS_ID = 'twfoxtetrio-race-results';

  const RACE_CSS = `
@keyframes twfoxRaceCardRot {
  from { transform: perspective(700px) rotateY(0deg); }
  to { transform: perspective(700px) rotateY(360deg); }
}
@keyframes twfoxRaceCardTilt {
  0% { transform: scale(1) rotateX(0deg); }
  40% { transform: scale(1.1) rotateX(-15deg); }
  70% { transform: scale(1.1) rotateX(15deg); }
  100% { transform: scale(1) rotateX(0deg); }
}
@keyframes twfoxRacePartyOpen {
  0% {
    opacity: 0;
    max-height: 6.2rem;
    overflow: hidden;
    transform: translateY(-8px) scaleY(0.94);
  }
  100% {
    opacity: 1;
    max-height: 36rem;
    overflow: hidden;
    transform: translateY(0) scaleY(1);
  }
}
@keyframes twfoxRaceReadySlide {
  from {
    margin-top: -2.4rem;
    opacity: 0.25;
  }
  to {
    margin-top: 0.85rem;
    opacity: 1;
  }
}
@keyframes twfoxRaceSlotIn {
  0% {
    opacity: 0;
    transform: translateY(-6px);
  }
  100% {
    opacity: 1;
    transform: translateY(0);
  }
}
#${CARD_ID} {
  transition: .3s transform;
}
#${CARD_ID}.is-race-selected {
  transform: translate3d(calc(var(--x) * 36.5rem), 0.5rem, 0) perspective(700px) rotate(var(--br)) scale(1);
}
#${CARD_ID}.is-race-selected:hover {
  transform: translate3d(calc(var(--x) * 36.5rem), -2.5rem, 0) perspective(700px) rotate(var(--br)) scale(1);
  z-index: 2;
}
#${CARD_ID}.is-race-selected:active {
  transform: translate3d(calc(var(--x) * 36.5rem), -2.5rem, -2rem) perspective(700px) rotate(var(--br)) scale(.9);
  transition: 50ms transform;
}
#${CARD_ID}.spin .zenith_card_rot {
  animation: .25s twfoxRaceCardRot cubic-bezier(.59, .08, .6, .93);
}
#${CARD_ID}.spin .zenith_card_tilt {
  animation: .25s twfoxRaceCardTilt linear;
}
#${CARD_ID} .zenith_card_front,
#${CARD_ID} .zenith_card_back,
#${CARD_ID} .zenith_card_throb,
#${CARD_ID} .zenith_card_outline {
  width: 13.2rem !important;
  height: 18rem !important;
  max-width: 13.2rem !important;
  max-height: 18rem !important;
}
#${CARD_ID} .zenith_card_outline {
  display: none;
}
#${CARD_ID}.is-race-selected .zenith_card_outline {
  display: block !important;
  filter: hue-rotate(-14deg) saturate(1.25);
}
#${CARD_ID} .zenith_card_throb {
  opacity: 0;
  transition: opacity 220ms ease;
}
#${CARD_ID}.is-race-selected .zenith_card_throb,
#${CARD_ID}:hover .zenith_card_throb {
  opacity: 0.72;
}

#zenithmenu.twfox-race-open #start_zenith {
  display: none !important;
}

#${PARTY_ID} {
  position: relative;
  z-index: 3;
  text-align: left;
  padding-top: 0.75rem;
  transform-origin: top center;
}
#${PARTY_ID}.hidden {
  display: none !important;
}
#${PARTY_ID}.is-opening:not(.hidden) {
  animation: 280ms cubic-bezier(.17, .65, .45, .99) twfoxRacePartyOpen;
}
#${PARTY_ID}.is-opening:not(.hidden) .twfox-race-ready-bar {
  animation: 300ms cubic-bezier(.17, .65, .45, .99) twfoxRaceReadySlide;
}
#${PARTY_ID}.is-opening:not(.hidden) .twfox-race-slot {
  animation: 240ms cubic-bezier(.21, .46, .62, 1) twfoxRaceSlotIn backwards;
}
#${PARTY_ID} .twfox-race-hdr {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: 0.6rem;
}
#${PARTY_ID} .twfox-race-title-group {
  display: flex;
  align-items: center;
  gap: 8px;
}
#${PARTY_ID} .twfox-race-title {
  margin: 0;
  font-size: 0.92rem;
  font-weight: 900;
  letter-spacing: 0.08em;
  color: #b26040;
}
#${PARTY_ID} .twfox-race-code-pill {
  padding: 2px 7px;
  border-radius: 3px;
  background: rgba(178, 96, 64, 0.16);
  border: 1px solid rgba(184, 58, 27, 0.7);
  color: #ff9c6b;
  font-size: 0.85rem;
  font-weight: 900;
  letter-spacing: 0.08em;
  cursor: pointer;
}
#${PARTY_ID} .twfox-race-code-pill:hover {
  border-color: #ff9c6b;
  color: #ffffff;
}
#${PARTY_ID} .twfox-race-join-row {
  display: flex;
  align-items: center;
  gap: 5px;
}
#${PARTY_ID} .twfox-race-input {
  width: 6.8rem;
  padding: 2px 6px;
  border-radius: 3px;
  border: 1px solid rgba(178, 96, 64, 0.45);
  background: rgba(0, 0, 0, 0.25);
  color: #ffd2bd;
  font-family: 'HUN', 'C', 'Segoe UI', sans-serif;
  font-weight: 800;
  font-size: 0.78rem;
  text-transform: uppercase;
}
#${PARTY_ID} .twfox-race-input::placeholder {
  color: rgba(178, 96, 64, 0.75);
}
#${PARTY_ID} .twfox-race-btn {
  position: relative;
  z-index: 4;
  pointer-events: auto;
  padding: 2px 8px;
  border-radius: 3px;
  border: 1px solid rgba(184, 58, 27, 0.7);
  background: rgba(100, 42, 24, 0.55);
  color: #ff9c6b;
  font-family: 'HUN', 'C', 'Segoe UI', sans-serif;
  font-weight: 900;
  font-size: 0.74rem;
  letter-spacing: 0.05em;
  cursor: pointer;
  transition: filter 120ms ease, color 120ms ease, border-color 120ms ease;
}
#${PARTY_ID} .twfox-race-btn:hover:not(:disabled) {
  filter: brightness(1.25);
  color: #ffffff;
  border-color: #ff9c6b;
}
#${PARTY_ID} .twfox-race-btn:disabled {
  opacity: 0.42;
  cursor: default;
}
#${PARTY_ID} .twfox-race-slots {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.5rem 0.9rem;
  position: relative;
}
#${PARTY_ID} .twfox-race-slot:nth-child(5) {
  grid-column: 1 / -1;
}
#${PARTY_ID} .twfox-race-slot {
  position: relative;
  height: 3.35rem;
  padding-left: 3.75rem;
  display: flex;
  flex-direction: column;
  justify-content: center;
  min-width: 0;
}
#${PARTY_ID} .twfox-race-avatar {
  position: absolute;
  top: 0.12rem;
  left: 0;
  width: 3.1rem;
  height: 3.1rem;
  border-radius: 4px;
  object-fit: cover;
  background: rgba(255, 140, 72, 0.14);
}
#${PARTY_ID} .twfox-race-avatar-badge {
  position: absolute;
  top: 0.12rem;
  left: 0;
  width: 3.1rem;
  height: 3.1rem;
  border-radius: 4px;
  background: rgba(130, 52, 26, 0.45);
  border: 1px solid rgba(255, 156, 107, 0.35);
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 900;
  font-size: 1.1rem;
  color: #ffb992;
}
#${PARTY_ID} .twfox-race-avatar-stub {
  position: absolute;
  top: 0.18rem;
  left: 0.06rem;
  width: 2.95rem;
  height: 2.95rem;
  box-sizing: border-box;
  border: 2.5px dotted #b26040;
  border-radius: 6px;
}
#${PARTY_ID} .twfox-race-slot-name {
  font-weight: 900;
  font-size: 1.05rem;
  line-height: 1.1;
  color: #ff9c6b;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
#${PARTY_ID} .twfox-race-slot.is-empty .twfox-race-slot-name {
  font-weight: 500;
  font-size: 0.92rem;
  color: #b26040;
}
#${PARTY_ID} .twfox-race-slot-sub {
  font-size: 0.7rem;
  font-weight: 800;
  letter-spacing: 0.05em;
  color: #b26040;
  margin-top: 2px;
}
#${PARTY_ID} .twfox-race-slot.is-ready .twfox-race-slot-sub {
  font-size: 0.9rem;
  font-weight: 900;
  color: #ffffff;
  text-shadow: 0 0 6px #ff9c6b;
}
#${PARTY_ID} .twfox-race-friends {
  position: relative;
  z-index: 4;
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 0.55rem;
  align-items: center;
}
#${PARTY_ID} .twfox-race-invite-note {
  font-size: 0.72rem;
  font-weight: 800;
  color: #ffba82;
  letter-spacing: 0.04em;
  margin-top: 4px;
}
#${PARTY_ID} .twfox-race-invite-note.is-err {
  color: #ff9185;
}
#${PARTY_ID} .twfox-race-invite-note.hidden {
  display: none;
}
#${PARTY_ID} .twfox-race-friends:empty {
  display: none;
}
#${PARTY_ID} .twfox-race-friend-pill {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 2px 7px;
  border-radius: 3px;
  background: rgba(83, 35, 20, 0.52);
  border: 1px solid rgba(184, 58, 27, 0.55);
  color: #ffd2bd;
  font-size: 0.74rem;
  font-weight: 800;
}
#${PARTY_ID} .twfox-race-ready-bar {
  display: block;
  width: calc(100% + 2rem + 6px);
  text-align: center;
  padding: 0.75rem 1rem 0.55rem;
  margin: calc(-1rem - 3px);
  margin-top: 0.85rem;
  border: 0;
  background-color: #532314;
  border-left: 3px solid #8d2e1b;
  border-bottom: 3px solid #2f0a0a;
  border-right: 3px solid #37160d;
  border-top: 3px solid #8d2e1b;
  box-shadow: 0 8px #210707;
  cursor: pointer;
  color: #ffd2bd;
  font-family: 'HUN', 'C', 'Segoe UI', sans-serif;
  transition: 180ms transform, 180ms filter, 180ms box-shadow, 180ms background-color;
}
#${PARTY_ID} .twfox-race-ready-bar:hover:not(:disabled) {
  box-shadow: 0 6px #210707;
  transform: translateY(2px);
  filter: brightness(1.18);
}
#${PARTY_ID} .twfox-race-ready-bar:active:not(:disabled),
#${PARTY_ID} .twfox-race-ready-bar.is-on {
  background-color: #420e0d;
  box-shadow: 0 4px #210707;
  transform: translateY(4px);
}
#${PARTY_ID} .twfox-race-ready-bar h1 {
  margin: 0 !important;
  font-size: 1.55rem !important;
  font-weight: 900;
  letter-spacing: 0.1em;
  color: #ffd2bd !important;
  text-shadow: 0 0 12px rgba(255, 156, 107, 0.45);
}
#${PARTY_ID} .twfox-race-ready-bar.is-on h1 {
  color: #a8ffcb !important;
  text-shadow: 0 0 14px rgba(92, 242, 156, 0.65);
}
#${PARTY_ID} .twfox-race-status {
  margin-top: 2px;
  font-size: 0.72rem;
  font-weight: 800;
  color: #b26040;
  letter-spacing: 0.08em;
}
#${PARTY_ID} .twfox-race-ready-bar.is-on .twfox-race-status {
  color: #ffd2bd;
}
.twfox-race-floating-back {
  position: fixed;
  right: 18px;
  bottom: 18px;
  z-index: 999998;
  padding: 9px 18px;
  border-radius: 4px;
  border: 2px solid #8d2e1b;
  background: #532314;
  color: #ffd2bd;
  font-family: 'HUN', 'C', 'Segoe UI', sans-serif;
  font-size: 0.85rem;
  font-weight: 900;
  letter-spacing: 0.08em;
  cursor: pointer;
}
.twfox-race-floating-back.hidden {
  display: none !important;
}

body.twfox-race-in-match #ingame_chat_container,
body.twfox-race-in-match #ingame_chat,
body.twfox-race-in-match #ingame_chat_input {
  opacity: 0 !important;
  visibility: hidden !important;
  pointer-events: none !important;
}

body.twfox-race-locked #start_zenith,
body.twfox-race-spectating #start_zenith {
  opacity: 0.42 !important;
  filter: grayscale(0.55) !important;
  pointer-events: none !important;
}

#${DOCK_ID} {
  position: fixed;
  inset: 0;
  z-index: 999996;
  pointer-events: none;
  user-select: none;
  font-family: 'HUN', 'C', 'Segoe UI', sans-serif;
  opacity: 0;
  transition: opacity 180ms ease;
}
#${DOCK_ID}:not(.is-visible) {
  visibility: hidden;
}
#${DOCK_ID}.is-visible {
  opacity: 1;
  visibility: visible;
}
#${DOCK_ID} .twfox-race-board-card {
  position: fixed;
  width: var(--twfox-corner-w, 172px);
  padding: 6px 6px 7px;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  justify-content: space-between;
  gap: 4px;
  border-radius: 6px;
  border: 2px solid rgba(245, 146, 76, 0.9);
  background: rgba(16, 8, 12, 0.9);
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.72);
  box-sizing: border-box;
}
#${DOCK_ID} .twfox-race-board-card[data-corner="tl"] {
  top: 84px;
  left: 46px;
}
#${DOCK_ID} .twfox-race-board-card[data-corner="tr"] {
  top: 12px;
  right: 12px;
}
#${DOCK_ID} .twfox-race-board-card[data-corner="bl"] {
  bottom: 14px;
  left: 46px;
}
#${DOCK_ID} .twfox-race-board-card[data-corner="br"] {
  bottom: 14px;
  right: 12px;
}
#${DOCK_ID} .twfox-race-board-card.is-ko {
  background: rgba(28, 10, 16, 0.86);
  border-color: rgba(255, 78, 108, 0.7);
  opacity: 0.84;
}
#${DOCK_ID} .twfox-race-board-name {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 5px;
  padding-bottom: 3px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  font-size: 0.74rem;
  font-weight: 900;
  color: #ffffff;
  white-space: nowrap;
  overflow: hidden;
}
#${DOCK_ID} .twfox-race-board-name .twfox-player-name {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
}
#${DOCK_ID} .twfox-race-board-rank {
  flex: 0 0 auto;
  padding: 1px 5px;
  border-radius: 3px;
  background: rgba(255, 146, 62, 0.24);
  border: 1px solid rgba(255, 154, 76, 0.62);
  color: #ffd085;
  font-size: 0.66rem;
  font-weight: 900;
}
#${DOCK_ID} .twfox-race-board-foot {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 4px;
  padding-top: 3px;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  width: 100%;
}
#${DOCK_ID} .twfox-race-board-alt {
  font-size: 0.88rem;
  font-weight: 900;
  color: #ffd37d;
  font-variant-numeric: tabular-nums;
}
#${DOCK_ID} .twfox-race-board-meta {
  font-size: 0.64rem;
  font-weight: 800;
  color: rgba(255, 224, 194, 0.84);
  white-space: nowrap;
}

body.twfox-race-spectating #zenithmenu:not(.twfox-peek-result) {
  opacity: 0 !important;
  pointer-events: none !important;
}

#${SPECTATOR_ID} {
  position: fixed;
  inset: 0;
  z-index: 999997;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 16px;
  background: radial-gradient(circle at center, rgba(24, 12, 20, 0.84), rgba(8, 5, 10, 0.94));
  color: #ffffff;
  font-family: 'HUN', 'C', 'Segoe UI', sans-serif;
}
#${SPECTATOR_ID}.hidden {
  display: none !important;
}
#${SPECTATOR_ID} .twfox-spec-topbar {
  width: min(calc(var(--twfox-spec-cols, 2) * 276px), 96vw);
  min-width: min(560px, 96vw);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
  margin-bottom: 10px;
  padding: 8px 14px;
  border-radius: 6px;
  border: 1.5px solid rgba(255, 132, 42, 0.74);
  background: rgba(20, 10, 14, 0.94);
  box-sizing: border-box;
}
#${SPECTATOR_ID} .twfox-spec-main {
  width: min(calc(var(--twfox-spec-cols, 2) * 276px), 96vw);
  max-width: 96vw;
  display: flex;
  flex-direction: row;
  flex-wrap: nowrap;
  align-items: stretch;
  justify-content: center;
  gap: 0;
  border-radius: 8px;
  border: 2px solid rgba(255, 145, 58, 0.8);
  background: rgba(12, 7, 12, 0.94);
  box-shadow: 0 14px 40px rgba(0, 0, 0, 0.76);
  overflow: hidden;
  box-sizing: border-box;
}
#${SPECTATOR_ID} .twfox-spec-runner {
  flex: 1 1 0;
  min-width: 0;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: 6px;
  padding: 8px 8px 10px;
  background: rgba(16, 9, 15, 0.92);
  cursor: pointer;
  box-sizing: border-box;
  transition: background 120ms ease;
}
#${SPECTATOR_ID} .twfox-spec-runner + .twfox-spec-runner {
  border-left: 1px solid rgba(255, 160, 92, 0.34);
}
#${SPECTATOR_ID} .twfox-spec-runner:hover:not(.is-ko) {
  background: rgba(34, 17, 16, 0.94);
}
#${SPECTATOR_ID} .twfox-spec-runner.is-watching {
  background: rgba(52, 23, 14, 0.94);
  box-shadow: inset 0 3px 0 #ff9442;
}
#${SPECTATOR_ID} .twfox-spec-runner.is-ko {
  background: rgba(18, 10, 16, 0.86);
  opacity: 0.76;
  cursor: default;
}
#${SPECTATOR_ID} .twfox-spec-card-hdr {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  padding-bottom: 4px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}
#${SPECTATOR_ID} .twfox-spec-card-identity {
  display: flex;
  align-items: center;
  gap: 5px;
  min-width: 0;
  font-weight: 900;
  font-size: 0.86rem;
  color: #ffffff;
}
#${SPECTATOR_ID} .twfox-spec-rank {
  flex: 0 0 auto;
  padding: 1px 5px;
  border-radius: 3px;
  background: rgba(255, 146, 62, 0.2);
  border: 1px solid rgba(255, 154, 76, 0.55);
  color: #ffd085;
  font-size: 0.72rem;
  font-weight: 900;
}
#${SPECTATOR_ID} .twfox-spec-runner.is-watching .twfox-spec-rank {
  background: #ff8e3c;
  color: #160a0d;
}
#${SPECTATOR_ID} .twfox-spec-status {
  flex: 0 0 auto;
  font-size: 0.66rem;
  font-weight: 900;
  letter-spacing: 0.06em;
  padding: 2px 5px;
  border-radius: 3px;
  background: rgba(94, 240, 156, 0.14);
  color: #84ffba;
  border: 1px solid rgba(94, 240, 156, 0.35);
}
#${SPECTATOR_ID} .twfox-spec-runner.is-ko .twfox-spec-status {
  background: rgba(255, 75, 110, 0.16);
  color: #ff8ea5;
  border-color: rgba(255, 75, 110, 0.35);
}
#${SPECTATOR_ID} .twfox-spec-card-foot {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding-top: 4px;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
}
#${SPECTATOR_ID} .twfox-spec-alt {
  font-size: 1.25rem;
  font-weight: 900;
  color: #ffd37d;
  font-variant-numeric: tabular-nums;
}
#${SPECTATOR_ID} .twfox-spec-meta {
  font-size: 0.7rem;
  font-weight: 800;
  color: rgba(255, 220, 185, 0.8);
  text-align: center;
  white-space: nowrap;
}
@media (max-width: 780px) {
  #${SPECTATOR_ID} .twfox-spec-main {
    flex-wrap: wrap;
  }
  #${SPECTATOR_ID} .twfox-spec-runner {
    flex: 1 1 48%;
  }
}

#${RESULTS_ID} {
  position: fixed;
  inset: 0;
  z-index: 999999;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  background: rgba(8, 5, 12, 0.86);
  backdrop-filter: blur(8px);
  font-family: 'HUN', 'C', 'Segoe UI', sans-serif;
  color: #ffffff;
}
#${RESULTS_ID}.hidden {
  display: none !important;
}
#${RESULTS_ID} .twfox-res-panel {
  width: min(680px, 94vw);
  padding: 22px 24px;
  border-radius: 8px;
  border: 2px solid #ff8c38;
  background: linear-gradient(180deg, rgba(38, 15, 14, 0.98), rgba(16, 9, 14, 0.98));
  box-shadow: 0 18px 48px rgba(0, 0, 0, 0.78);
}
#${RESULTS_ID} .twfox-res-title {
  margin: 0 0 4px;
  font-size: 1.5rem;
  font-weight: 900;
  color: #ffc87c;
  letter-spacing: 0.06em;
}
#${RESULTS_ID} .twfox-res-sub {
  margin: 0 0 14px;
  font-size: 0.92rem;
  font-weight: 800;
  color: rgba(255, 222, 186, 0.82);
}
#${RESULTS_ID} .twfox-res-table {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 18px;
}
#${RESULTS_ID} .twfox-res-item {
  display: grid;
  grid-template-columns: 54px minmax(0, 1.5fr) repeat(3, minmax(0, 1fr));
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  border-radius: 5px;
  border: 1.5px solid rgba(255, 255, 255, 0.14);
  background: rgba(255, 255, 255, 0.04);
}
#${RESULTS_ID} .twfox-res-item.is-first {
  border-color: #ffd166;
  background: rgba(255, 196, 66, 0.14);
}
#${RESULTS_ID} .twfox-res-item.is-self {
  box-shadow: inset 3px 0 0 #ff7b1c;
}
#${RESULTS_ID} .twfox-res-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}
#${RESULTS_ID} .twfox-race-next-btn {
  padding: 10px 28px;
  border-radius: 5px;
  border: 2px solid #ffb066;
  background: linear-gradient(180deg, #ff7b1c, #cc4e07);
  color: #ffffff;
  font-family: 'HUN', 'C', 'Segoe UI', sans-serif;
  font-size: 1rem;
  font-weight: 900;
  letter-spacing: 0.08em;
  cursor: pointer;
}
#${RESULTS_ID} .twfox-race-next-btn:hover {
  filter: brightness(1.18);
}
`;

  function el(tag, opts, children) {
    const node = document.createElement(tag);
    if (opts) {
      if (opts.id) node.id = opts.id;
      if (opts.className) node.className = opts.className;
      if (opts.text !== undefined) node.textContent = opts.text;
      if (opts.html !== undefined) node.innerHTML = opts.html;
      if (opts.style) node.setAttribute('style', opts.style);
      if (opts.type && tag === 'button') node.type = opts.type;
      if (opts.attrs) {
        for (const [k, v] of Object.entries(opts.attrs)) {
          node.setAttribute(k, v);
        }
      }
    }
    if (Array.isArray(children)) {
      for (const ch of children) {
        if (ch) node.appendChild(ch);
      }
    }
    return node;
  }

  function setClass(node, cls, on) {
    if (!node || !node.classList) return;
    if (on) node.classList.add(cls);
    else node.classList.remove(cls);
  }

  function ensureStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const head = document.head || document.documentElement;
    if (!head) return;
    const st = document.createElement('style');
    st.id = STYLE_ID;
    st.textContent = RACE_CSS;
    head.appendChild(st);
  }

  function formatRaceDuration(ms) {
    const safe = Math.max(0, Math.floor((Number(ms) || 0) / 1000));
    const m = Math.floor(safe / 60);
    const s = safe % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  }

  function copyText(str) {
    if (!str) return;
    try {
      if (root.navigator && root.navigator.clipboard && typeof root.navigator.clipboard.writeText === 'function') {
        root.navigator.clipboard.writeText(str);
      }
    } catch (_) {}
  }

  function initZenRace() {
    ensureStyle();

    let session = null;
    let sessionUnsub = null;
    let cardSelected = false;
    let racePhase = 'idle'; // 'idle' | 'countdown' | 'entering' | 'alive' | 'dead' | 'results'
    let hasEnteredLivePlay = false;
    let raceStartedAt = 0;
    let countdownRemainingSec = 0;
    let countdownUiTimer = null;
    let pollTimer = null;
    let lastBoardSentAt = 0;
    let selfPeakAltitude = 0;
    let selfPeakFloor = 1;
    let selfLastSnapshot = null;
    let spectatingTargetId = null;
    let peekMyResult = false;
    let inviteCooldownTicker = null;
    let statusOverride = '';
    let isMountingDom = false;
    let cardSpinTimer = null;
    let partyOpenAnimTimer = null;
    let wasPartyShown = false;
    let suppressDuoObserver = false;
    let duoClassObserver = null;
    let observedZMenuForDuo = null;
    let observedDuoCardForClass = null;
    let presenceUnsub = null;
    let lastSlotsSignature = '';
    let lastFriendsListKey = '';
    let lastRenderedSelfName = '';
    let inviteNoteText = '';
    let inviteNoteIsError = false;
    const inviteBtnsByUser = new Map();

    const inviteTracker = foxInviteLogic && typeof foxInviteLogic.createInviteTracker === 'function'
      ? foxInviteLogic.createInviteTracker()
      : null;

    let cardEl = null;
    let infoEl = null;
    let partyEl = null;
    let slotsEl = null;
    let codePillEl = null;
    let friendsEl = null;
    let inviteNoteEl = null;
    let joinInputEl = null;
    let joinBtnEl = null;
    let readyBtnEl = null;
    let readyLabelEl = null;
    let leaveBtnEl = null;
    let statusEl = null;
    let dockEl = null;
    let dockBoardsEl = null;
    let allowProgrammaticRaceStart = false;
    let specEl = null;
    let specHeaderEl = null;
    let specCanvasEl = null;
    let specTopbarEl = null;
    let specSubEl = null;
    let specListEl = null;
    let specPeekBtnEl = null;
    let backToSpecBtnEl = null;
    let resultsEl = null;
    let resultsSubEl = null;
    let resultsTableEl = null;
    let resultsNextBtnEl = null;

    const rivalCanvases = new Map();
    const specCanvases = new Map();

    function getSelfUsername() {
      const st = api.getState ? api.getState() : null;
      const fromState = st && st.selfUsername ? String(st.selfUsername).trim() : '';
      if (fromState) return fromState;
      const meEl = document.getElementById('me_username');
      return meEl && meEl.textContent ? meEl.textContent.trim() : 'PLAYER';
    }

    function getFoxBadge() {
      const bag = root.__TWFOX_INTERNAL__ || internals;
      return (bag && bag.foxPawBadge) || null;
    }

    const avatarCacheByUser = new Map();
    const avatarFetchInFlight = new Set();
    let hasSeenZenithVisibleForSession = false;

    function normalizeNameKey(raw) {
      return foxInviteLogic
        ? foxInviteLogic.normalizeUsername(raw)
        : String(raw || '').trim().toLowerCase();
    }

    function sanitizeAvatarUrlSafe(raw) {
      const trimmed = String(raw || '').trim();
      if (!trimmed) return '';
      let candidate = trimmed;
      if (candidate.startsWith('//')) {
        candidate = 'https:' + candidate;
      } else if (candidate.startsWith('/')) {
        candidate = 'https://tetr.io' + candidate;
      }
      if (p2pRoom && typeof p2pRoom.sanitizeAvatarUrl === 'function') {
        return p2pRoom.sanitizeAvatarUrl(candidate);
      }
      return /^https?:\/\/[^\s"'<>]+$/i.test(candidate) ? candidate : '';
    }

    function extractNodeAvatarUrl(node) {
      if (!node) return '';
      const directSrc = typeof node.src === 'string' && node.src.trim()
        ? node.src.trim()
        : (typeof node.getAttribute === 'function' ? String(node.getAttribute('src') || '').trim() : '');
      if (directSrc) return sanitizeAvatarUrlSafe(directSrc);
      const bg = node.style && typeof node.style.backgroundImage === 'string' ? node.style.backgroundImage : '';
      const m = bg.match(/url\(\s*(['"]?)(.*?)\1\s*\)/i);
      return m && m[2] ? sanitizeAvatarUrlSafe(m[2]) : '';
    }

    function requestRemoteAvatar(username) {
      const norm = normalizeNameKey(username);
      if (!norm || norm === 'player' || avatarCacheByUser.has(norm) || avatarFetchInFlight.has(norm)) return;
      const fetchFn = typeof root.fetch === 'function' ? root.fetch : null;
      if (!fetchFn) return;
      avatarFetchInFlight.add(norm);
      Promise.resolve()
        .then(() => fetchFn('https://ch.tetr.io/api/users/' + encodeURIComponent(norm)))
        .then((res) => (res && res.ok && typeof res.json === 'function' ? res.json() : null))
        .then((payload) => {
          const userObj = payload && payload.data ? (payload.data.user || payload.data) : null;
          let url = '';
          if (userObj && userObj._id && userObj.avatar_revision) {
            url = sanitizeAvatarUrlSafe(
              'https://tetr.io/user-content/avatars/' +
              encodeURIComponent(String(userObj._id)) +
              '.jpg?rv=' +
              encodeURIComponent(String(userObj.avatar_revision))
            );
          }
          avatarCacheByUser.set(norm, url);
          if (url && (cardSelected || session)) {
            renderParty();
          }
        })
        .catch(() => {
          avatarCacheByUser.set(norm, '');
        })
        .finally(() => {
          avatarFetchInFlight.delete(norm);
        });
    }

    function getSelfAvatarUrl() {
      const selfIds = ['zenith_party_self_avatar', 'me_avatar', 'me_avatar_img'];
      for (const id of selfIds) {
        const found = extractNodeAvatarUrl(document.getElementById(id));
        if (found) return found;
      }
      const foxBadge = getFoxBadge();
      const selfName = getSelfUsername();
      if (foxBadge && typeof foxBadge.getAvatarUrl === 'function') {
        const fromBadge = sanitizeAvatarUrlSafe(foxBadge.getAvatarUrl(selfName));
        if (fromBadge) return fromBadge;
      }
      const norm = normalizeNameKey(selfName);
      if (norm && avatarCacheByUser.has(norm)) {
        return avatarCacheByUser.get(norm) || '';
      }
      if (norm && norm !== 'player') {
        requestRemoteAvatar(selfName);
      }
      return '';
    }

    function resolvePlayerAvatar(playerObj, selfId) {
      if (!playerObj) return '';
      const cleanName = String(playerObj.name || '').trim();
      const fromPeer = sanitizeAvatarUrlSafe(playerObj.avatar || '');
      if (playerObj.id === selfId) {
        const selfUrl = getSelfAvatarUrl();
        if (selfUrl) return selfUrl;
      }
      if (fromPeer) return fromPeer;
      const foxBadge = getFoxBadge();
      if (foxBadge && typeof foxBadge.getAvatarUrl === 'function') {
        const fromBadge = sanitizeAvatarUrlSafe(foxBadge.getAvatarUrl(cleanName));
        if (fromBadge) return fromBadge;
      }
      const norm = normalizeNameKey(cleanName);
      if (norm && avatarCacheByUser.has(norm)) {
        return avatarCacheByUser.get(norm) || '';
      }
      if (norm && norm !== 'player') {
        requestRemoteAvatar(cleanName);
      }
      return '';
    }

    function isInQuickPlayLobbyUi() {
      const zMenu = document.getElementById('zenithmenu');
      if (!zMenu) return false;
      if (zMenu.classList && zMenu.classList.contains('hidden')) return false;
      const inZenithBody = Boolean(document.body && document.body.classList && document.body.classList.contains('inzenith'));
      if (inZenithBody) return true;
      const menusEl = document.getElementById('menus');
      const menuType = menusEl && typeof menusEl.getAttribute === 'function' ? menusEl.getAttribute('data-menu-type') : '';
      if (menuType && menuType !== 'zenith') return false;
      return Boolean(menuType === 'zenith' || document.getElementById('zenith_deck_cards'));
    }

    function triggerLeaveQuickPlayCleanup() {
      hasSeenZenithVisibleForSession = false;
      clearCardSpin();
      cardSelected = false;
      if (session) {
        teardownRaceSession(true);
      } else {
        syncVisualState();
      }
    }

    function bindLeaveZenithButton() {
      const leaveZp = document.getElementById('leavezenith');
      if (leaveZp && !leaveZp.__twfoxRaceLeaveBound && typeof leaveZp.addEventListener === 'function') {
        leaveZp.__twfoxRaceLeaveBound = true;
        leaveZp.addEventListener('click', () => {
          triggerLeaveQuickPlayCleanup();
        });
      }
      bindStartZenithGuard();
    }

    function bindStartZenithGuard() {
      const startBtn = document.getElementById('start_zenith');
      if (startBtn && !startBtn.__twfoxRaceStartGuard) {
        startBtn.__twfoxRaceStartGuard = true;
        if (typeof startBtn.click === 'function') {
          const origClick = startBtn.click;
          startBtn.click = function () {
            if (!allowProgrammaticRaceStart && isNewGameLaunchBlocked()) {
              return;
            }
            return origClick.apply(this, arguments);
          };
        }
        if (typeof startBtn.addEventListener === 'function') {
          startBtn.addEventListener('click', (ev) => {
            if (!allowProgrammaticRaceStart && isNewGameLaunchBlocked()) {
              if (ev && typeof ev.preventDefault === 'function') ev.preventDefault();
              if (ev && typeof ev.stopPropagation === 'function') ev.stopPropagation();
              if (ev && typeof ev.stopImmediatePropagation === 'function') ev.stopImmediatePropagation();
            }
          }, true);
        }
      }
    }

    function stopRaceLoop() {
      if (pollTimer) {
        clearInterval(pollTimer);
        pollTimer = null;
      }
      if (countdownUiTimer) {
        clearInterval(countdownUiTimer);
        countdownUiTimer = null;
      }
    }

    function stopInviteTicker() {
      if (inviteCooldownTicker) {
        clearInterval(inviteCooldownTicker);
        inviteCooldownTicker = null;
      }
    }

    function findDuoCard() {
      const byId = document.getElementById('zenith-duo-card');
      if (byId) return byId;
      const deckCards = document.getElementById('zenith_deck_cards');
      if (!deckCards || typeof deckCards.querySelectorAll !== 'function') return null;
      const cards = deckCards.querySelectorAll('.zenith_card');
      for (const ch of cards) {
        if (ch && ch !== cardEl && typeof ch.getAttribute === 'function' && ch.getAttribute('data-card') === 'duo') {
          return ch;
        }
      }
      return null;
    }

    function isDuoActiveNow() {
      const zMenu = document.getElementById('zenithmenu');
      const duoCard = findDuoCard();
      return Boolean(
        (zMenu && zMenu.classList && zMenu.classList.contains('duo')) ||
        (duoCard && duoCard.classList && duoCard.classList.contains('active'))
      );
    }

    function triggerCardSpin() {
      if (!cardEl || !cardEl.classList) return;
      if (cardSpinTimer) {
        clearTimeout(cardSpinTimer);
        cardSpinTimer = null;
      }
      cardEl.classList.remove('spin');
      if (typeof cardEl.getBoundingClientRect === 'function') {
        cardEl.getBoundingClientRect();
      }
      cardEl.classList.add('spin');
      cardSpinTimer = setTimeout(() => {
        if (cardEl && cardEl.classList) cardEl.classList.remove('spin');
        cardSpinTimer = null;
      }, 250);
      if (cardSpinTimer && typeof cardSpinTimer.unref === 'function') cardSpinTimer.unref();
    }

    function clearCardSpin() {
      if (cardSpinTimer) {
        clearTimeout(cardSpinTimer);
        cardSpinTimer = null;
      }
      if (cardEl && cardEl.classList) {
        cardEl.classList.remove('spin');
      }
    }

    function deactivateDuoCardIfActive() {
      const zMenu = document.getElementById('zenithmenu');
      const duoCard = findDuoCard();
      if (!isDuoActiveNow()) return;
      suppressDuoObserver = true;
      try {
        if (duoCard && typeof duoCard.click === 'function') {
          if (duoCard.classList) duoCard.classList.add('forceoff');
          try {
            duoCard.click();
          } finally {
            if (duoCard.classList) duoCard.classList.remove('forceoff');
          }
        }
        if (duoCard && duoCard.classList && duoCard.classList.contains('active')) {
          duoCard.classList.remove('active');
        }
        if (zMenu && zMenu.classList && zMenu.classList.contains('duo')) {
          zMenu.classList.remove('duo');
        }
      } finally {
        suppressDuoObserver = false;
      }
    }

    function fanAllDeckCardsEvenly(restoreDefaultInfo) {
      const deckCards = document.getElementById('zenith_deck_cards');
      if (!deckCards || !deckCards.children) return;
      const count = deckCards.children.length;
      for (let i = 0; i < count; i++) {
        const ch = deckCards.children[i];
        if (ch && ch.style && typeof ch.style.setProperty === 'function') {
          const xVal = count > 1 ? 0.8 * (1 - i / (count - 1)) + 0.1 : 0.5;
          ch.style.setProperty('--x', String(xVal));
        }
        setClass(ch, 'hover-blocked', false);
      }
      if (restoreDefaultInfo) {
        if (infoEl) setClass(infoEl, 'hidden', true);
        const deckInfos = document.getElementById('zenith_deck_infos');
        if (deckInfos && typeof deckInfos.querySelectorAll === 'function') {
          const infos = deckInfos.querySelectorAll('.zenith_deck_info');
          for (const inf of infos) {
            if (inf && typeof inf.getAttribute === 'function' && inf.getAttribute('data-for') === 'x-nocard') {
              setClass(inf, 'hidden', false);
            }
          }
        }
      }
    }

    function focusRaceCardVisual() {
      const deckCards = document.getElementById('zenith_deck_cards');
      if (!deckCards || !deckCards.children || !cardEl) return;
      const children = Array.from(deckCards.children);
      const n = children.indexOf(cardEl);
      if (n < 0) return;
      const t = children.length;
      const s = (n / Math.max(1, t - 1)) * 0.8 + 0.1;
      for (let i = 0; i < t; i++) {
        let o = 0;
        if (i === n) o = s;
        else if (i === 0) o = 0;
        else if (i < n) o = (i / n) * Math.max(0.05, s - 0.2);
        else if (i > n) o = 1 - (1 - (i - n) / (t - 1 - n)) * Math.min(0.95, 1 - (s + 0.2));
        o = 1 - o;
        if (children[i] && children[i].style) {
          children[i].style.setProperty('--x', String(o));
        }
        setClass(children[i], 'hover-blocked', i < n - 1 || i > n + 1);
      }
      const infos = document.querySelectorAll('.zenith_deck_info');
      for (const inf of infos) setClass(inf, 'hidden', true);
      if (infoEl) setClass(infoEl, 'hidden', false);
    }

    function teardownRaceSession(resetPhase) {
      stopRaceLoop();
      stopInviteTicker();
      if (sessionUnsub) {
        sessionUnsub();
        sessionUnsub = null;
      }
      if (session) {
        session.close();
        session = null;
      }
      if (resetPhase !== false) {
        clearCardSpin();
        racePhase = 'idle';
        hasEnteredLivePlay = false;
        peekMyResult = false;
        spectatingTargetId = null;
        statusOverride = '';
        inviteNoteText = '';
        inviteNoteIsError = false;
        lastSlotsSignature = '';
        lastFriendsListKey = '';
        inviteBtnsByUser.clear();
      }
      syncVisualState();
    }

    function ensureHostSessionCreated() {
      if (session || !p2pRoom) return session;
      hasSeenZenithVisibleForSession = isInQuickPlayLobbyUi();
      const hostName = getSelfUsername() || 'HOST';
      session = p2pRoom.createHostServer({
        hostName,
        hostAvatar: getSelfAvatarUrl(),
        roomName: `${hostName}'S RACE`,
        gameMode: raceLogic.RACE_GAME_MODE,
        maxPlayers: raceLogic.MAX_RACE_PLAYERS,
        countdownMs: raceLogic.RACE_COUNTDOWN_MS
      });
      sessionUnsub = session.subscribe(handleSessionEvent);
      return session;
    }

    function isNewGameLaunchBlocked() {
      return Boolean(session && (racePhase === 'countdown' || racePhase === 'dead' || racePhase === 'results'));
    }

    function isOverlayKeyboardLocked() {
      return Boolean(session && ((racePhase === 'dead' && !peekMyResult) || racePhase === 'results'));
    }

    function readUserRetryKeySet() {
      const defaults = new Set(['R', 'KEYR']);
      try {
        const raw = root.localStorage && root.localStorage.getItem('userConfig');
        if (!raw) return defaults;
        const parsed = JSON.parse(raw);
        const list = parsed && parsed.controls && Array.isArray(parsed.controls.retry) ? parsed.controls.retry : null;
        if (list && list.length > 0) {
          const custom = new Set();
          for (const k of list) {
            const norm = String(k || '').trim().toUpperCase();
            if (norm) custom.add(norm);
          }
          if (custom.size > 0) return custom;
        }
      } catch (_) {}
      return defaults;
    }

    function launchOfficialQuickPlayRun() {
      const startBtn = document.getElementById('start_zenith');
      if (startBtn && typeof startBtn.click === 'function') {
        allowProgrammaticRaceStart = true;
        try {
          startBtn.click();
        } finally {
          allowProgrammaticRaceStart = false;
        }
      }
    }

    function startLivePolling() {
      if (pollTimer) return;
      pollTimer = setInterval(sampleAndBroadcastLocalRun, 95);
      if (pollTimer && typeof pollTimer.unref === 'function') pollTimer.unref();
    }

    function sampleAndBroadcastLocalRun() {
      if (!session || (racePhase !== 'entering' && racePhase !== 'alive')) return;
      const bodyEl = document.body;
      const zMenu = document.getElementById('zenithmenu');
      const inZenith = Boolean(bodyEl && bodyEl.classList && bodyEl.classList.contains('inzenith'));
      const inPhys = Boolean(bodyEl && bodyEl.classList && bodyEl.classList.contains('ingame_phys'));
      const inResults = Boolean(zMenu && zMenu.classList && zMenu.classList.contains('inresults'));
      const rolledUp = Boolean(zMenu && zMenu.classList && zMenu.classList.contains('rolledup'));

      const zSnap = typeof api.getSelfZenithSnapshot === 'function'
        ? api.getSelfZenithSnapshot()
        : null;
      const wrapperAlive = Boolean(zSnap && zSnap.found && zSnap.alive);
      const isPlayingNow = Boolean(inZenith && (wrapperAlive || inPhys || (rolledUp && !inResults)));

      if (racePhase === 'entering') {
        if (isPlayingNow) {
          hasEnteredLivePlay = true;
          racePhase = 'alive';
          peekMyResult = false;
        } else if (Date.now() - raceStartedAt > 18000) {
          // Player failed or cancelled entering Quick Play -> finish gracefully
          hasEnteredLivePlay = true;
        } else {
          return;
        }
      }

      if (racePhase === 'alive') {
        if (zSnap && zSnap.found) {
          const curAlt = raceLogic.clampAltitude(zSnap.altitude);
          if (curAlt > selfPeakAltitude) selfPeakAltitude = curAlt;
          const fl = raceLogic.computeFloorFromAltitude(selfPeakAltitude, zSnap.floor);
          if (fl.floor > selfPeakFloor) selfPeakFloor = fl.floor;

          const compactBoard = raceLogic.normalizeCompactBoard(zSnap.board, zSnap.falling, zSnap.bufferHeight);
          const payload = {
            compactBoard,
            hold: typeof raceLogic.sanitizePieceKey === 'function' ? raceLogic.sanitizePieceKey(zSnap.hold) : (zSnap.hold || null),
            canHold: zSnap.canHold !== false,
            next: typeof raceLogic.sanitizeNextQueue === 'function' ? raceLogic.sanitizeNextQueue(zSnap.next) : (Array.isArray(zSnap.next) ? zSnap.next.slice(0, 5) : []),
            altitude: curAlt,
            peakAltitude: selfPeakAltitude,
            floor: fl.floor,
            durationMs: Math.max(0, zSnap.elapsedMs || (Date.now() - raceStartedAt)),
            score: zSnap.score || 0,
            lines: zSnap.lines || 0,
            pps: zSnap.pps || 0,
            apm: zSnap.apm || 0
          };
          selfLastSnapshot = payload;
          const now = Date.now();
          if (now - lastBoardSentAt >= 85) {
            lastBoardSentAt = now;
            session.updateSelfBoard(payload);
          }
        }

        const toppedOut = Boolean(
          hasEnteredLivePlay && (
            (zSnap && zSnap.found && zSnap.alive === false && !inPhys) ||
            (inZenith && inResults && !inPhys && !rolledUp) ||
            (!inZenith && Date.now() - raceStartedAt > 2500)
          )
        );
        if (toppedOut) {
          const resEl = document.getElementById('zenith_result');
          if (resEl && quickPlayLogic) {
            const parsedRes = quickPlayLogic.parseAltitudeText(resEl.textContent);
            if (parsedRes > selfPeakAltitude) {
              selfPeakAltitude = parsedRes;
            }
          }
          selfPeakFloor = raceLogic.computeFloorFromAltitude(selfPeakAltitude, selfPeakFloor).floor;
          const finalPayload = Object.assign({}, selfLastSnapshot || {}, {
            altitude: selfPeakAltitude,
            peakAltitude: selfPeakAltitude,
            floor: selfPeakFloor,
            durationMs: Math.max(
              selfLastSnapshot ? selfLastSnapshot.durationMs : 0,
              Date.now() - raceStartedAt
            )
          });
          racePhase = 'dead';
          session.reportSelfKo(finalPayload);
          syncVisualState();
        } else {
          renderDock();
        }
      }
    }

    function sendRaceInvite(targetUsername) {
      if (!foxInviteLogic) return false;
      const activeSession = session || ensureHostSessionCreated();
      if (!activeSession) return false;
      const snap = activeSession.getSnapshot();
      const players = snap.players || [];
      if (players.length >= raceLogic.MAX_RACE_PLAYERS) {
        statusOverride = `Room is full (max ${raceLogic.MAX_RACE_PLAYERS} racers).`;
        inviteNoteText = statusOverride;
        inviteNoteIsError = true;
        renderParty();
        return false;
      }
      const foxBadge = getFoxBadge();
      const roomCode = (snap.room && snap.room.roomCode) || '';
      if (!roomCode || !foxBadge || typeof foxBadge.sendRoomInvite !== 'function') {
        statusOverride = 'FOXMOD invite relay unavailable.';
        inviteNoteText = statusOverride;
        inviteNoteIsError = true;
        renderParty();
        return false;
      }
      const normTarget = foxInviteLogic.normalizeUsername(targetUsername);
      if (!normTarget) return false;
      const invStatus = typeof foxBadge.getFriendInviteStatus === 'function'
        ? foxBadge.getFriendInviteStatus(normTarget)
        : { invitable: true, reason: '', badge: '' };
      if (!invStatus.invitable) {
        statusOverride = invStatus.reason === 'league'
          ? `${normTarget.toUpperCase()} is in TETRA LEAGUE.`
          : invStatus.reason === 'busy'
            ? `${normTarget.toUpperCase()} is BUSY.`
            : `${normTarget.toUpperCase()} is offline.`;
        inviteNoteText = statusOverride;
        inviteNoteIsError = true;
        renderParty();
        return false;
      }
      if (foxInviteLogic.isUserInRoom(normTarget, players)) {
        statusOverride = `${normTarget.toUpperCase()} is already in the room.`;
        inviteNoteText = statusOverride;
        inviteNoteIsError = false;
        renderParty();
        return false;
      }
      const now = Date.now();
      if (inviteTracker && !inviteTracker.canInvite(normTarget, now, players)) {
        const rem = inviteTracker.getCooldownRemainingSec(normTarget, now);
        statusOverride = `Wait ${rem}s before inviting ${normTarget.toUpperCase()} again.`;
        inviteNoteText = statusOverride;
        inviteNoteIsError = true;
        renderParty();
        return false;
      }
      const res = foxBadge.sendRoomInvite(normTarget, {
        from: getSelfUsername(),
        roomCode,
        roomName: snap.room.roomName || 'THE RACE',
        gameMode: raceLogic.RACE_GAME_MODE,
        pieceSet: 'zenith',
        ts: now
      });
      if (res && res.ok) {
        if (inviteTracker) inviteTracker.recordSent(normTarget, now);
        statusOverride = `Sent orange FOXMOD invite to ${normTarget.toUpperCase()}! (${30}s cooldown)`;
        inviteNoteText = `SENT ORANGE INVITE TO ${normTarget.toUpperCase()}!`;
        inviteNoteIsError = false;
        ensureInviteTicker();
      } else {
        statusOverride = res && res.reason === 'offline' ? 'Relay offline — share #CODE manually.' : 'Could not send invite.';
        inviteNoteText = statusOverride;
        inviteNoteIsError = true;
      }
      renderParty();
      return Boolean(res && res.ok);
    }

    function ensurePresenceWatch() {
      const foxBadge = getFoxBadge();
      if (!presenceUnsub && foxBadge && typeof foxBadge.onPresenceUpdate === 'function') {
        presenceUnsub = foxBadge.onPresenceUpdate(() => {
          if (cardSelected && partyEl && !partyEl.classList.contains('hidden')) {
            renderParty();
          }
        });
      }
    }

    function ensureInviteTicker() {
      if (inviteCooldownTicker) return;
      inviteCooldownTicker = setInterval(() => {
        if (!cardSelected || !partyEl || partyEl.classList.contains('hidden')) {
          stopInviteTicker();
          return;
        }
        renderParty();
      }, 1000);
      if (inviteCooldownTicker && typeof inviteCooldownTicker.unref === 'function') inviteCooldownTicker.unref();
    }

    function handleSessionEvent(snap, evType, detail) {
      if (!snap) return;

      if (evType === 'race_countdown') {
        racePhase = 'countdown';
        const ms = (detail && detail.countdownMs) || raceLogic.RACE_COUNTDOWN_MS;
        countdownRemainingSec = Math.max(1, Math.ceil(ms / 1000));
        if (countdownUiTimer) clearInterval(countdownUiTimer);
        countdownUiTimer = setInterval(() => {
          if (countdownRemainingSec > 1) {
            countdownRemainingSec -= 1;
            renderParty();
          } else {
            clearInterval(countdownUiTimer);
            countdownUiTimer = null;
          }
        }, 1000);
        if (countdownUiTimer && typeof countdownUiTimer.unref === 'function') countdownUiTimer.unref();
      } else if (evType === 'race_countdown_cancel') {
        if (countdownUiTimer) {
          clearInterval(countdownUiTimer);
          countdownUiTimer = null;
        }
        racePhase = 'idle';
        countdownRemainingSec = 0;
      } else if (evType === 'match_start') {
        if (countdownUiTimer) {
          clearInterval(countdownUiTimer);
          countdownUiTimer = null;
        }
        racePhase = 'entering';
        hasEnteredLivePlay = false;
        raceStartedAt = Date.now();
        selfPeakAltitude = 0;
        selfPeakFloor = 1;
        selfLastSnapshot = null;
        spectatingTargetId = null;
        peekMyResult = false;
        startLivePolling();
        launchOfficialQuickPlayRun();
        sampleAndBroadcastLocalRun();
      } else if (evType === 'round_end') {
        stopRaceLoop();
        racePhase = 'results';
        peekMyResult = false;
        renderResults(snap, detail);
      } else if (evType === 'lobby_reset') {
        stopRaceLoop();
        // Only dismiss results immediately if we weren't viewing post-race standings;
        // each player dismisses their own Final Leaderboard using the NEXT button.
        if (racePhase !== 'results') {
          racePhase = 'idle';
          peekMyResult = false;
          spectatingTargetId = null;
        }
      } else if (evType === 'host_closed') {
        teardownRaceSession(true);
        cardSelected = false;
        const helpers = internals.foxMenuHelpers;
        if (helpers && typeof helpers.showOrangeNoticeNotification === 'function') {
          helpers.showOrangeNoticeNotification('FOXMOD ROOM CLOSED', 'The Race Host closed the room.');
        }
      } else if (evType === 'webrtc_failed' && detail && detail.reason) {
        statusOverride = `Error: ${detail.reason}`;
      }

      syncVisualState();
    }

    function renderParty() {
      if (!partyEl) return;
      const zMenu = document.getElementById('zenithmenu');
      const snap = session ? session.getSnapshot() : null;
      const showParty = Boolean(cardSelected && (racePhase === 'idle' || racePhase === 'countdown'));
      if (zMenu) {
        setClass(zMenu, 'twfox-race-open', showParty);
      }
      if (showParty && !wasPartyShown) {
        if (partyOpenAnimTimer) {
          clearTimeout(partyOpenAnimTimer);
          partyOpenAnimTimer = null;
        }
        setClass(partyEl, 'is-opening', true);
        partyOpenAnimTimer = setTimeout(() => {
          setClass(partyEl, 'is-opening', false);
          partyOpenAnimTimer = null;
        }, 320);
        if (partyOpenAnimTimer && typeof partyOpenAnimTimer.unref === 'function') partyOpenAnimTimer.unref();
      } else if (!showParty) {
        if (partyOpenAnimTimer) {
          clearTimeout(partyOpenAnimTimer);
          partyOpenAnimTimer = null;
        }
        setClass(partyEl, 'is-opening', false);
      }
      wasPartyShown = showParty;
      setClass(partyEl, 'hidden', !showParty);
      if (!showParty) return;

      const isHost = !snap || snap.role === 'host';
      const selfId = isHost ? 'host' : snap.selfId;
      const players = (snap && Array.isArray(snap.players) ? snap.players : [{
        id: 'host',
        name: getSelfUsername(),
        isHost: true,
        ready: false,
        connected: true
      }]).filter((p) => p && !p.disconnected).slice(0, raceLogic.MAX_RACE_PLAYERS);
      const roomCode = (snap && snap.room && snap.room.roomCode) || '';
      const activeList = players.filter((p) => !p.spectator && !p.disconnected);
      const readyCount = activeList.filter((p) => Boolean(p.ready)).length;

      if (codePillEl) {
        codePillEl.textContent = roomCode ? `#${roomCode}` : '#LOCAL';
      }

      const selfAvatarSrc = getSelfAvatarUrl();
      const resolvedAvatars = players.map((p) => resolvePlayerAvatar(p, selfId));
      lastRenderedSelfName = getSelfUsername();
      ensurePresenceWatch();

      let needsBadgeRescan = false;
      const slotsKey =
        roomCode +
        '|' +
        selfAvatarSrc +
        '|' +
        players.map((p, idx) => `${p.id}:${p.name}:${p.ready ? 1 : 0}:${p.isHost ? 1 : 0}:${resolvedAvatars[idx] || ''}`).join(';');

      if (slotsEl && slotsKey !== lastSlotsSignature) {
        lastSlotsSignature = slotsKey;
        needsBadgeRescan = true;
        slotsEl.innerHTML = '';
        for (let i = 0; i < raceLogic.MAX_RACE_PLAYERS; i++) {
          const p = players[i] || null;
          if (!p) {
            slotsEl.appendChild(
              el('div', { className: 'twfox-race-slot is-empty' }, [
                el('div', { className: 'twfox-race-avatar-stub' }),
                el('div', { className: 'twfox-race-slot-name', text: 'WAITING FOR PLAYER' }),
                el('div', { className: 'twfox-race-slot-sub', text: `SLOT ${i + 1}/${raceLogic.MAX_RACE_PLAYERS} · INVITE FRIEND` })
              ])
            );
            continue;
          }
          const slotClasses = ['twfox-race-slot', p.ready ? 'is-ready' : ''].filter(Boolean).join(' ');
          const cleanName = String(p.name || 'PLAYER');
          const slotAvatar = resolvedAvatars[i] || '';
          const badgeEl = el('div', {
            className: 'twfox-race-avatar-badge',
            text: cleanName.slice(0, 2).toUpperCase(),
            style: slotAvatar ? 'display:none;' : ''
          });
          const slotChildren = [badgeEl];
          if (slotAvatar) {
            const avatarImg = el('img', {
              className: 'twfox-race-avatar',
              attrs: { src: slotAvatar, alt: '' }
            });
            if (typeof avatarImg.addEventListener === 'function') {
              avatarImg.addEventListener('error', () => {
                if (badgeEl) {
                  if (badgeEl.style) badgeEl.style.display = '';
                  setClass(badgeEl, 'hidden', false);
                }
                if (avatarImg.parentNode && typeof avatarImg.parentNode.removeChild === 'function') {
                  avatarImg.parentNode.removeChild(avatarImg);
                } else if (typeof avatarImg.remove === 'function') {
                  avatarImg.remove();
                } else {
                  if (avatarImg.style) avatarImg.style.display = 'none';
                  setClass(avatarImg, 'hidden', true);
                }
              });
            }
            slotChildren.push(avatarImg);
          }
          slotChildren.push(
            el('div', {
              className: 'twfox-race-slot-name twfox-paw-target twfox-player-name',
              text: cleanName + (p.id === selfId ? ' (YOU)' : ''),
              attrs: { 'data-username': cleanName.toLowerCase() }
            }),
            el('div', {
              className: 'twfox-race-slot-sub',
              text: p.ready ? 'READY!' : (p.isHost ? 'HOST' : 'WAITING')
            })
          );
          slotsEl.appendChild(
            el('div', { className: slotClasses }, slotChildren)
          );
        }
      }

      const me = players.find((p) => p.id === selfId) || null;
      const myReady = Boolean(me ? me.ready : (snap && snap.ready));
      if (readyBtnEl) {
        setClass(readyBtnEl, 'is-on', myReady);
        readyBtnEl.disabled = !session;
      }
      if (readyLabelEl) {
        readyLabelEl.textContent = racePhase === 'countdown'
          ? `STARTING ${Math.max(1, countdownRemainingSec)}`
          : (myReady ? 'READY ✓' : 'READY');
      }

      const foxBadge = getFoxBadge();
      if (friendsEl) {
        const mutuals = foxBadge && typeof foxBadge.listOnlineMutualFoxers === 'function'
          ? foxBadge.listOnlineMutualFoxers()
          : [];
        const visibleMutuals = (mutuals && players.length < raceLogic.MAX_RACE_PLAYERS) ? mutuals.slice(0, 6) : [];
        const friendsListKey = visibleMutuals
          .map((m) => (foxInviteLogic ? foxInviteLogic.normalizeUsername(m.username) : String(m.username || '').toLowerCase()))
          .join(',');

        if (friendsListKey !== lastFriendsListKey) {
          lastFriendsListKey = friendsListKey;
          friendsEl.innerHTML = '';
          inviteBtnsByUser.clear();
          if (visibleMutuals.length > 0) {
            needsBadgeRescan = true;
            const label = el('span', {
              style: 'font-size:0.72rem;font-weight:800;color:#b26040;letter-spacing:0.06em;',
              text: 'INVITE:'
            });
            friendsEl.appendChild(label);
            for (const fr of visibleMutuals) {
              const normU = foxInviteLogic
                ? foxInviteLogic.normalizeUsername(fr.username)
                : String(fr.username || '').toLowerCase();
              const btn = el('button', {
                className: 'twfox-race-btn',
                type: 'button',
                text: 'INVITE',
                attrs: { 'data-race-invite': normU }
              });
              btn.addEventListener('click', (ev) => {
                if (ev && typeof ev.stopPropagation === 'function') ev.stopPropagation();
                if (!btn.disabled) {
                  sendRaceInvite(normU);
                }
              });
              inviteBtnsByUser.set(normU, btn);
              friendsEl.appendChild(
                el('div', { className: 'twfox-race-friend-pill' }, [
                  el('span', {
                    className: 'twfox-paw-target twfox-player-name',
                    text: String(fr.username || '').toUpperCase(),
                    attrs: { 'data-username': fr.username }
                  }),
                  btn
                ])
              );
            }
          }
        }

        const now = Date.now();
        for (const [normU, btn] of inviteBtnsByUser.entries()) {
          const inRoom = Boolean(foxInviteLogic && foxInviteLogic.isUserInRoom(normU, players));
          const invStatus = foxBadge && typeof foxBadge.getFriendInviteStatus === 'function'
            ? foxBadge.getFriendInviteStatus(normU)
            : { invitable: true, reason: '', badge: '' };
          const blocked = !invStatus.invitable;
          const blockBadge = invStatus.badge || 'BUSY';
          const cd = inviteTracker ? inviteTracker.getCooldownRemainingSec(normU, now) : 0;
          const stateKey = inRoom
            ? 'in_room'
            : blocked
              ? `blocked:${blockBadge}`
              : cd > 0
                ? `wait:${cd}`
                : (!roomCode ? 'no_code' : 'ready');
          const nextDisabled = Boolean(inRoom || blocked || cd > 0 || !roomCode);
          if (btn.disabled !== nextDisabled) {
            btn.disabled = nextDisabled;
          }
          if (btn.__twfoxStateKey !== stateKey) {
            btn.__twfoxStateKey = stateKey;
            btn.textContent = inRoom
              ? 'IN ROOM'
              : blocked
                ? blockBadge
                : cd > 0
                  ? `WAIT ${cd}S`
                  : 'INVITE';
            if (typeof btn.setAttribute === 'function') {
              if (blocked) {
                btn.setAttribute(
                  'title',
                  invStatus.reason === 'league'
                    ? 'Playing or queued in TETRA LEAGUE'
                    : 'Player status is Busy or Offline'
                );
              } else if (typeof btn.removeAttribute === 'function') {
                btn.removeAttribute('title');
              } else {
                btn.setAttribute('title', '');
              }
            }
          }
        }
      }

      if (inviteNoteEl) {
        inviteNoteEl.textContent = inviteNoteText || '';
        setClass(inviteNoteEl, 'is-err', Boolean(inviteNoteIsError));
        setClass(inviteNoteEl, 'hidden', !inviteNoteText);
      }

      if (statusEl) {
        if (statusOverride) {
          statusEl.textContent = statusOverride;
        } else if (racePhase === 'countdown') {
          statusEl.textContent = `STARTING IN ${Math.max(1, countdownRemainingSec)}...`;
        } else if (activeList.length < raceLogic.MIN_RACE_PLAYERS) {
          statusEl.textContent = `THE RACE (${activeList.length}/${raceLogic.MAX_RACE_PLAYERS}) · NEED AT LEAST 2 RACERS`;
        } else if (readyCount === activeList.length) {
          statusEl.textContent = 'ALL PLAYERS READY — LAUNCHING TOGETHER!';
        } else {
          statusEl.textContent = `THE RACE (${activeList.length}/${raceLogic.MAX_RACE_PLAYERS}) · READY ${readyCount}/${activeList.length}`;
        }
      }

      if (needsBadgeRescan && foxBadge && typeof foxBadge.rescan === 'function') {
        foxBadge.rescan();
      }
    }

    function drawPlayerRaceBoard(canvas, player, placement, compact) {
      if (!canvas || !foxmodCanvas) return;
      if (typeof foxmodCanvas.renderRacePlayfield === 'function') {
        foxmodCanvas.renderRacePlayfield(
          canvas,
          {
            board: player.board,
            alive: player.alive,
            placement,
            hold: player.hold || null,
            canHold: player.canHold !== false,
            next: Array.isArray(player.next) ? player.next : []
          },
          { compact: Boolean(compact) }
        );
      } else if (typeof foxmodCanvas.renderMiniBoard === 'function') {
        foxmodCanvas.renderMiniBoard(canvas, player.board, player.alive, placement);
      }
    }

    const CORNER_ORDER = ['tr', 'tl', 'br', 'bl'];

    function computeCornerCardWidth() {
      const vw = Number(root.innerWidth) > 0 ? Number(root.innerWidth) : 1280;
      const vh = Number(root.innerHeight) > 0 ? Number(root.innerHeight) : 720;
      const maxVertW = Math.floor(((vh - 150) / 2 - 48) * (264 / 336));
      const maxHorizW = Math.floor(vw * 0.275 - 56);
      return Math.max(122, Math.min(maxVertW, maxHorizW, 215));
    }

    function renderDock() {
      if (!dockEl || !dockBoardsEl) return;
      // Keep the active player's TETR.IO board at full centered scale at all times
      if (typeof api.setRaceBoardTransform === 'function') {
        api.setRaceBoardTransform(null);
      }

      const bodyEl = document.body;
      const inZenith = Boolean(bodyEl && bodyEl.classList && bodyEl.classList.contains('inzenith'));
      const showDock = Boolean(session && racePhase === 'alive' && inZenith);
      if (!showDock) {
        setClass(dockEl, 'is-visible', false);
        dockBoardsEl.innerHTML = '';
        return;
      }

      const snap = session.getSnapshot();
      const isHost = snap.role === 'host';
      const selfId = isHost ? 'host' : snap.selfId;
      const activePool = (snap.players || []).filter((p) => !p.spectator).slice(0, raceLogic.MAX_RACE_PLAYERS);
      const ranked = raceLogic.computeRaceStandings(activePool, [], 0, 0);

      const rivals = activePool.filter((p) => p.id !== selfId);
      const activeDockIds = new Set(rivals.map((p) => p.id));
      for (const oldId of Array.from(rivalCanvases.keys())) {
        if (!activeDockIds.has(oldId)) rivalCanvases.delete(oldId);
      }

      if (rivals.length === 0) {
        setClass(dockEl, 'is-visible', false);
        dockBoardsEl.innerHTML = '';
        return;
      }

      const cornerCardW = computeCornerCardWidth();
      if (dockEl.style && typeof dockEl.style.setProperty === 'function') {
        dockEl.style.setProperty('--twfox-corner-w', `${cornerCardW}px`);
      }

      dockBoardsEl.innerHTML = '';
      for (let i = 0; i < rivals.length && i < CORNER_ORDER.length; i++) {
        const pl = rivals[i];
        const corner = CORNER_ORDER[i];
        const rankInfo = ranked.find((r) => r.id === pl.id);
        const rankNum = rankInfo ? rankInfo.placement : '-';
        const peakAlt = Math.max(Number(pl.peakAltitude) || 0, Number(pl.altitude) || 0);
        const floorInfo = raceLogic.computeFloorFromAltitude(peakAlt, pl.floor);
        let c = rivalCanvases.get(pl.id);
        if (!c) {
          c = el('canvas', {
            attrs: { width: '264', height: '336' },
            style: 'display:block;width:100%;height:auto;border-radius:2px;'
          });
          rivalCanvases.set(pl.id, c);
        }
        drawPlayerRaceBoard(c, pl, pl.alive === false ? rankNum : null, false);
        const cardClasses = ['twfox-race-board-card', pl.alive === false ? 'is-ko' : ''].filter(Boolean).join(' ');
        dockBoardsEl.appendChild(
          el('div', {
            className: cardClasses,
            attrs: { 'data-race-player': pl.id, 'data-corner': corner }
          }, [
            el('div', { className: 'twfox-race-board-name' }, [
              el('span', { className: 'twfox-player-name', text: pl.name }),
              el('span', { className: 'twfox-race-board-rank', text: `Nº${rankNum}` })
            ]),
            c,
            el('div', { className: 'twfox-race-board-foot' }, [
              el('span', { className: 'twfox-race-board-alt', text: `${peakAlt.toFixed(1)} M` }),
              el('span', { className: 'twfox-race-board-meta', text: `F${floorInfo.floor} · ${(Number(pl.pps) || 0).toFixed(1)}/S` })
            ])
          ])
        );
      }
      setClass(dockEl, 'is-visible', true);
    }

    function renderSpectator() {
      if (!specEl) return;
      const snap = session ? session.getSnapshot() : null;
      const players = (snap && snap.players)
        ? snap.players.filter((p) => p && !p.spectator && !p.disconnected).slice(0, raceLogic.MAX_RACE_PLAYERS)
        : [];
      const selfId = snap ? (snap.role === 'host' ? 'host' : snap.selfId) : 'host';
      const target = raceLogic.pickNextAliveTarget(players, selfId, spectatingTargetId);
      const shouldShow = Boolean(session && racePhase === 'dead' && target && !peekMyResult);

      if (document.body) {
        setClass(document.body, 'twfox-race-spectating', Boolean(session && racePhase === 'dead' && target && !peekMyResult));
      }
      if (backToSpecBtnEl) {
        setClass(backToSpecBtnEl, 'hidden', !(session && racePhase === 'dead' && target && peekMyResult));
      }
      setClass(specEl, 'hidden', !shouldShow);
      if (!shouldShow) return;

      spectatingTargetId = target.id;
      const ranked = raceLogic.computeRaceStandings(players, [], 0, 0);
      const colCount = Math.max(2, Math.min(raceLogic.MAX_RACE_PLAYERS, players.length || 2));
      if (specEl.style && typeof specEl.style.setProperty === 'function') {
        specEl.style.setProperty('--twfox-spec-cols', String(colCount));
      }

      if (specHeaderEl) {
        specHeaderEl.textContent = `SPECTATING ${String(target.name || 'RUNNER').toUpperCase()}`;
      }
      if (specSubEl) {
        specSubEl.textContent = `YOUR ALTITUDE: ${selfPeakAltitude.toFixed(1)} M · CLICK A RUNNER TO FOCUS`;
      }

      if (specListEl) {
        specListEl.innerHTML = '';
        const activeIds = new Set(players.map((p) => p.id));
        for (const oldId of Array.from(specCanvases.keys())) {
          if (!activeIds.has(oldId)) specCanvases.delete(oldId);
        }

        for (const pl of players) {
          const rankInfo = ranked.find((r) => r.id === pl.id);
          const rankNum = rankInfo ? rankInfo.placement : '-';
          const peakAlt = Math.max(Number(pl.peakAltitude) || 0, Number(pl.altitude) || 0);
          const floorInfo = raceLogic.computeFloorFromAltitude(peakAlt, pl.floor);
          const isAlive = pl.alive !== false && !pl.disconnected;
          const isWatching = pl.id === target.id;
          const isSelf = pl.id === selfId;

          let c = specCanvases.get(pl.id);
          if (!c) {
            c = el('canvas', {
              attrs: { width: '264', height: '336' },
              style: 'display:block;width:100%;height:auto;border-radius:3px;'
            });
            specCanvases.set(pl.id, c);
          }
          if (isWatching) {
            if (specCanvasEl && specCanvasEl !== c) {
              if (typeof specCanvasEl.removeAttribute === 'function') {
                specCanvasEl.removeAttribute('id');
              } else {
                specCanvasEl.id = '';
              }
            }
            if (typeof c.setAttribute === 'function') {
              c.setAttribute('id', 'twfoxtetrio-race-spec-canvas');
            } else {
              c.id = 'twfoxtetrio-race-spec-canvas';
            }
            specCanvasEl = c;
          } else if (c.id === 'twfoxtetrio-race-spec-canvas') {
            if (typeof c.removeAttribute === 'function') {
              c.removeAttribute('id');
            } else {
              c.id = '';
            }
          }

          drawPlayerRaceBoard(c, pl, isAlive ? null : rankNum, false);

          const card = el('div', {
            className: [
              'twfox-spec-runner',
              isWatching ? 'is-watching' : '',
              !isAlive ? 'is-ko' : ''
            ].filter(Boolean).join(' '),
            attrs: { 'data-spec-player-id': pl.id }
          }, [
            el('div', { className: 'twfox-spec-card-hdr' }, [
              el('div', { className: 'twfox-spec-card-identity' }, [
                el('span', { className: 'twfox-spec-rank', text: `Nº${rankNum}` }),
                el('span', { className: 'twfox-player-name', text: String(pl.name || 'RUNNER') + (isSelf ? ' (YOU)' : '') })
              ]),
              el('span', { className: 'twfox-spec-status', text: isAlive ? 'LIVE' : 'KO' })
            ]),
            c,
            el('div', { className: 'twfox-spec-card-foot' }, [
              el('div', { className: 'twfox-spec-alt', text: `${peakAlt.toFixed(1)} M · F${floorInfo.floor}` }),
              el('div', {
                className: 'twfox-spec-meta',
                text: `${floorInfo.name} · ${(Number(pl.pps) || 0).toFixed(2)} PPS · ${Number(pl.lines) || 0} L`
              })
            ])
          ]);
          if (isAlive && pl.id !== selfId) {
            card.addEventListener('click', () => {
              spectatingTargetId = pl.id;
              renderSpectator();
            });
          }
          specListEl.appendChild(card);
        }
      }
    }

    function renderResults(snap, detail) {
      if (!resultsEl) return;
      const showRes = Boolean(session && racePhase === 'results');
      setClass(resultsEl, 'hidden', !showRes);
      if (!showRes) return;

      const standings = (detail && Array.isArray(detail.standings) && detail.standings) ||
        (snap && snap.room && Array.isArray(snap.room.lastResults) && snap.room.lastResults) ||
        raceLogic.computeRaceStandings((snap && snap.players) || [], [], raceStartedAt, Date.now());

      const isHost = snap && snap.role === 'host';
      const selfId = isHost ? 'host' : snap && snap.selfId;
      const top = standings[0];

      if (resultsSubEl) {
        resultsSubEl.textContent = top
          ? `Nº1 ${top.name} · ${Number(top.altitude || 0).toFixed(1)} M (FLOOR ${top.floor || 1})`
          : 'ALL RUNNERS FINISHED!';
      }

      if (resultsTableEl) {
        resultsTableEl.innerHTML = '';
        for (const item of standings) {
          const isSelf = item.id === selfId;
          const rowClasses = [
            'twfox-res-item',
            item.placement === 1 ? 'is-first' : '',
            isSelf ? 'is-self' : ''
          ].filter(Boolean).join(' ');
          resultsTableEl.appendChild(
            el('div', { className: rowClasses }, [
              el('div', { style: 'font-weight:900;font-size:1.1rem;color:#ffd166;', text: `Nº${item.placement}` }),
              el('div', {
                className: 'twfox-player-name twfox-paw-target',
                style: 'font-weight:900;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;',
                text: item.name + (isSelf ? ' (YOU)' : ''),
                attrs: { 'data-username': String(item.name || '').toLowerCase() }
              }),
              el('div', { style: 'font-weight:900;color:#ffd085;', text: `${Number(item.altitude || 0).toFixed(1)} M` }),
              el('div', { style: 'font-weight:800;color:#e8c7ff;', text: `FLOOR ${item.floor || 1}` }),
              el('div', { style: 'font-weight:800;color:#b8d0ff;text-align:right;', text: formatRaceDuration(item.durationMs) })
            ])
          );
        }
      }
      const foxBadge = getFoxBadge();
      if (foxBadge && typeof foxBadge.rescan === 'function') {
        foxBadge.rescan();
      }
    }

    function syncVisualState() {
      isMountingDom = true;
      try {
        if (cardEl) {
          setClass(cardEl, 'is-race-selected', cardSelected);
        }
        if (document.body) {
          const inMatch = Boolean(session && (racePhase === 'entering' || racePhase === 'alive' || racePhase === 'dead'));
          setClass(document.body, 'twfox-race-in-match', inMatch);
          setClass(document.body, 'twfox-race-locked', isNewGameLaunchBlocked());
        }
        renderParty();
        renderDock();
        renderSpectator();
        if (resultsEl) {
          setClass(resultsEl, 'hidden', racePhase !== 'results');
        }
      } finally {
        isMountingDom = false;
      }
    }

    function selectRaceCard(nextState) {
      const nextBool = Boolean(nextState);
      if (nextBool === cardSelected) {
        syncVisualState();
        return;
      }
      if (nextBool) {
        deactivateDuoCardIfActive();
        cardSelected = true;
        triggerCardSpin();
        if (!session) {
          ensureHostSessionCreated();
        }
      } else {
        clearCardSpin();
        cardSelected = false;
        if (session && racePhase === 'idle') {
          const snap = session.getSnapshot();
          if (!snap.players || snap.players.length <= 1) {
            teardownRaceSession(true);
            return;
          }
        }
      }
      syncVisualState();
    }

    async function joinRaceByCode(rawCode) {
      if (!p2pRoom) return;
      const clean = foxInviteLogic ? foxInviteLogic.normalizeRoomCode(rawCode) : String(rawCode || '').trim().replace(/^#/, '').toUpperCase();
      if (!clean) {
        statusOverride = 'Enter a valid #CODE.';
        renderParty();
        return;
      }

      const rState = api.getState ? api.getState() : null;
      const zMenu = document.getElementById('zenithmenu');
      const inZenithBody = Boolean(document.body && document.body.classList && document.body.classList.contains('inzenith'));
      const inOfficialCustomOrTl = !inZenithBody && (
        Boolean(document.body && document.body.classList && document.body.classList.contains('innormalmulti')) ||
        Boolean(rState && rState.inMultiplayer && !(rState && rState.inZenith))
      );
      const zSnapNow = typeof api.getSelfZenithSnapshot === 'function' ? api.getSelfZenithSnapshot() : null;
      const inQuickPlayMatch = Boolean(
        (document.body && document.body.classList && document.body.classList.contains('ingame_phys')) ||
        (zSnapNow && zSnapNow.found && zSnapNow.alive)
      );
      const inNonZenithGame = !inZenithBody && Boolean(
        (rState && rState.inGame) ||
        (document.body && document.body.classList && document.body.classList.contains('ingame'))
      );

      if (!isInQuickPlayLobbyUi() || inOfficialCustomOrTl || inQuickPlayMatch || inNonZenithGame) {
        const helpers = internals.foxMenuHelpers;
        if (helpers && typeof helpers.showOrangeNoticeNotification === 'function') {
          helpers.showOrangeNoticeNotification(
            'ENTER QUICK PLAY FIRST',
            `Go to Quick Play (Zenith Tower) in TETR.IO first, then accept the Race invite (#${clean}).`
          );
        }
        return;
      }

      if (zMenu && zMenu.classList && zMenu.classList.contains('rolledup')) {
        const rollupBtn = typeof zMenu.querySelector === 'function' ? zMenu.querySelector('.menuslide_rollup') : null;
        if (rollupBtn && typeof rollupBtn.click === 'function') {
          rollupBtn.click();
        } else {
          zMenu.classList.remove('rolledup');
        }
      }

      const helpers = internals.foxMenuHelpers;
      if (helpers && typeof helpers.hideFoxmodScrollersImmediately === 'function') {
        helpers.hideFoxmodScrollersImmediately();
      }
      const socialEl = document.getElementById('social');
      const socialBg = document.getElementById('social_bg');
      if (socialEl && socialEl.classList && socialEl.classList.contains('open') && socialBg && typeof socialBg.click === 'function') {
        socialBg.click();
      }

      deactivateDuoCardIfActive();
      teardownRaceSession(true);
      hasSeenZenithVisibleForSession = isInQuickPlayLobbyUi();
      cardSelected = true;
      triggerCardSpin();
      statusOverride = `Connecting to Race #${clean}...`;
      const myName = getSelfUsername() || 'PLAYER';
      session = p2pRoom.createClientPeer({
        playerName: myName,
        avatar: getSelfAvatarUrl(),
        joinTimeoutMs: 12000
      });
      sessionUnsub = session.subscribe(handleSessionEvent);
      syncVisualState();

      try {
        await session.joinByCode(clean);
        statusOverride = '';
        renderParty();
      } catch (err) {
        statusOverride = err && err.message ? err.message : 'Failed to join Race.';
        renderParty();
      }
    }

    function ensureOverlaysMounted() {
      if (!dockEl && document.body) {
        dockBoardsEl = el('div', { className: 'twfox-race-corners-layer' });
        dockEl = el('div', { id: DOCK_ID }, [dockBoardsEl]);
        document.body.appendChild(dockEl);
      }

      if (!specEl && document.body) {
        specHeaderEl = el('div', {
          id: 'twfoxtetrio-race-spectate-target',
          style: 'font-size:1.05rem;font-weight:900;color:#ffbe7b;',
          text: 'SPECTATING'
        });
        specSubEl = el('span', {
          style: 'font-size:0.76rem;font-weight:800;color:#ffd09e;',
          text: 'CLICK A RUNNER TO FOCUS'
        });
        specPeekBtnEl = el('button', {
          id: 'twfoxtetrio-race-peek-btn',
          className: 'twfox-race-btn',
          type: 'button',
          text: 'PEEK MY RESULT'
        });
        specPeekBtnEl.addEventListener('click', () => {
          peekMyResult = true;
          syncVisualState();
        });
        specTopbarEl = el('div', { className: 'twfox-spec-topbar' }, [
          specHeaderEl,
          specSubEl,
          specPeekBtnEl
        ]);
        specListEl = el('div', { className: 'twfox-spec-main' });
        specEl = el('div', { id: SPECTATOR_ID, className: 'hidden' }, [
          specTopbarEl,
          specListEl
        ]);
        document.body.appendChild(specEl);
      }

      if (!backToSpecBtnEl && document.body) {
        backToSpecBtnEl = el('button', {
          id: 'twfoxtetrio-race-back-spec-btn',
          className: 'twfox-race-floating-back hidden',
          type: 'button',
          text: 'BACK TO SPECTATOR'
        });
        backToSpecBtnEl.addEventListener('click', () => {
          peekMyResult = false;
          syncVisualState();
        });
        document.body.appendChild(backToSpecBtnEl);
      }

      if (!resultsEl && document.body) {
        resultsSubEl = el('p', {
          id: 'twfoxtetrio-race-winner-name',
          className: 'twfox-res-sub',
          text: 'ALL RUNNERS FINISHED!'
        });
        resultsTableEl = el('div', { className: 'twfox-res-table' });
        resultsNextBtnEl = el('button', {
          id: 'twfoxtetrio-race-next-btn',
          className: 'twfox-race-next-btn',
          type: 'button',
          text: 'NEXT'
        });
        resultsNextBtnEl.addEventListener('click', () => {
          racePhase = 'idle';
          peekMyResult = false;
          spectatingTargetId = null;
          if (session) {
            const snap = session.getSnapshot();
            if (snap.role === 'host' && typeof session.resetLobby === 'function') {
              session.resetLobby();
            } else if (snap.role === 'client' && typeof session.setReady === 'function') {
              session.setReady(false);
            }
          }
          syncVisualState();
        });
        resultsEl = el('div', { id: RESULTS_ID, className: 'hidden' }, [
          el('div', { className: 'twfox-res-panel' }, [
            el('h1', { className: 'twfox-res-title', text: 'RACE COMPLETE · FINAL STANDINGS' }),
            resultsSubEl,
            resultsTableEl,
            el('div', { className: 'twfox-res-actions' }, [resultsNextBtnEl])
          ])
        ]);
        document.body.appendChild(resultsEl);
      }
    }

    function ensureZenithDomMounted() {
      if (isMountingDom) return false;
      const deckCards = document.getElementById('zenith_deck_cards');
      const deckInfos = document.getElementById('zenith_deck_infos');
      const zMenu = document.getElementById('zenithmenu');
      if (!deckCards || !zMenu) {
        if (session) {
          isMountingDom = true;
          try {
            ensureOverlaysMounted();
          } finally {
            isMountingDom = false;
          }
        }
        return false;
      }

      isMountingDom = true;
      try {
        ensureOverlaysMounted();

        if (!document.getElementById(INFO_ID) && deckInfos) {
          infoEl = el('div', {
            id: INFO_ID,
            className: 'zenith_deck_info hidden',
            attrs: { 'data-for': 'race' }
          }, [
            el('h1', { text: 'THE RACE' }),
            el('p', { text: '5-player visual tower race — climb at full size with 4 corner rivals' })
          ]);
          deckInfos.appendChild(infoEl);
        } else {
          infoEl = document.getElementById(INFO_ID);
        }

        if (!document.getElementById(CARD_ID)) {
          const art = raceLogic.buildRaceCardArtUrls();
          cardEl = el('div', {
            id: CARD_ID,
            className: 'zenith_card rg_zenith_card twfox-race-card',
            style: '--x: 1;',
            attrs: {
              'data-card': 'race',
              'data-floor': '0',
              'data-hover': 'tap',
              'data-hit': 'click'
            }
          }, [
            el('div', { className: 'zenith_card_rot' }, [
              el('div', { className: 'zenith_card_tilt' }, [
                el('img', { className: 'zenith_card_back', attrs: { src: art.backUrl, alt: '' } }),
                el('img', { className: 'zenith_card_front', attrs: { src: art.frontUrl, alt: 'THE RACE' } }),
                el('img', { className: 'zenith_card_throb', attrs: { src: art.throbUrl, alt: '' } }),
                el('img', { className: 'zenith_card_outline', attrs: { src: '/res/zenith-mods/outline.png', alt: '' } })
              ])
            ])
          ]);

          cardEl.addEventListener('mouseenter', function () {
            focusRaceCardVisual();
          });
          cardEl.addEventListener('mousemove', function (ev) {
            const w = cardEl.clientWidth || 132;
            const h = cardEl.clientHeight || 180;
            if (cardEl.style && ev && typeof ev.offsetX === 'number') {
              cardEl.style.setProperty('--rx', ((ev.offsetX - w / 2) / w) * 20 + 'deg');
              cardEl.style.setProperty('--ry', ((ev.offsetY - h / 2) / h) * -20 + 'deg');
            }
          });
          cardEl.addEventListener('mouseleave', function () {
            if (cardEl.style && typeof cardEl.style.setProperty === 'function') {
              cardEl.style.setProperty('--rx', '0deg');
              cardEl.style.setProperty('--ry', '0deg');
            }
          });
          cardEl.addEventListener('click', function (ev) {
            if (ev && typeof ev.preventDefault === 'function') ev.preventDefault();
            if (ev && typeof ev.stopImmediatePropagation === 'function') ev.stopImmediatePropagation();
            if (ev && typeof ev.stopPropagation === 'function') ev.stopPropagation();
            selectRaceCard(!cardSelected);
          }, true);

          deckCards.insertBefore(cardEl, deckCards.firstChild || null);
          fanAllDeckCardsEvenly(false);

          if (!deckCards.__twfoxRaceLeaveBound) {
            deckCards.__twfoxRaceLeaveBound = true;
            deckCards.addEventListener('mouseleave', () => {
              fanAllDeckCardsEvenly(true);
            });
          }
        } else {
          cardEl = document.getElementById(CARD_ID);
        }

        if (!document.getElementById(PARTY_ID)) {
          const slides = zMenu.querySelector('.menuslide') || zMenu;
          const deckBlock = document.getElementById('zenith_deck_block');

          codePillEl = el('div', {
            id: 'twfoxtetrio-race-room-code',
            className: 'twfox-race-code-pill twfox-code-value',
            text: '#----',
            attrs: { title: 'Click to copy Race room code' }
          });
          codePillEl.addEventListener('click', () => {
            const snap = session && session.getSnapshot();
            if (snap && snap.room && snap.room.roomCode) {
              copyText('#' + snap.room.roomCode);
              statusOverride = `Copied #${snap.room.roomCode} to clipboard!`;
              renderParty();
            }
          });

          leaveBtnEl = el('button', {
            id: 'twfoxtetrio-race-leave-btn',
            className: 'twfox-race-btn',
            type: 'button',
            text: 'LEAVE RACE'
          });
          leaveBtnEl.addEventListener('click', () => {
            cardSelected = false;
            teardownRaceSession(true);
          });

          slotsEl = el('div', { id: 'twfoxtetrio-race-players', className: 'twfox-race-slots' });
          friendsEl = el('div', { className: 'twfox-race-friends' });
          inviteNoteEl = el('div', {
            id: 'twfoxtetrio-race-invite-note',
            className: 'twfox-race-invite-note hidden',
            text: ''
          });

          joinInputEl = el('input', {
            id: 'twfoxtetrio-race-join-input',
            className: 'twfox-race-input',
            attrs: { type: 'text', placeholder: 'ENTER #CODE', maxlength: '10' }
          });
          joinBtnEl = el('button', {
            id: 'twfoxtetrio-race-join-btn',
            className: 'twfox-race-btn',
            type: 'button',
            text: 'JOIN'
          });
          joinBtnEl.addEventListener('click', () => {
            joinRaceByCode(joinInputEl.value);
          });
          joinInputEl.addEventListener('keydown', (ev) => {
            if (ev && (ev.key === 'Enter' || ev.code === 'Enter')) {
              joinRaceByCode(joinInputEl.value);
            }
          });

          readyLabelEl = el('h1', { text: 'READY' });
          statusEl = el('div', {
            id: 'twfoxtetrio-race-status',
            className: 'twfox-race-status',
            text: `THE RACE (1/${raceLogic.MAX_RACE_PLAYERS}) · NEED AT LEAST 2 RACERS`
          });
          readyBtnEl = el('button', {
            id: 'twfoxtetrio-race-ready-btn',
            className: 'twfox-race-ready-bar',
            type: 'button',
            attrs: { 'data-hover': 'hover', 'data-hit': 'confirm' }
          }, [readyLabelEl, statusEl]);
          readyBtnEl.addEventListener('click', () => {
            statusOverride = '';
            const s = session || ensureHostSessionCreated();
            if (!s) return;
            const snap = s.getSnapshot();
            const selfId = snap.role === 'host' ? 'host' : snap.selfId;
            const me = (snap.players || []).find((p) => p.id === selfId);
            const nextReady = !(me ? me.ready : snap.ready);
            if (typeof s.setReady === 'function') {
              s.setReady(nextReady);
            }
          });

          partyEl = el('div', {
            id: PARTY_ID,
            className: 'scroller_block hidden',
            attrs: { 'data-zenithmenu-context': 'both' }
          }, [
            el('div', { className: 'twfox-race-hdr' }, [
              el('div', { className: 'twfox-race-title-group' }, [
                el('span', { className: 'twfox-race-title', text: 'THE RACE' }),
                codePillEl
              ]),
              el('div', { className: 'twfox-race-join-row' }, [joinInputEl, joinBtnEl, leaveBtnEl])
            ]),
            slotsEl,
            friendsEl,
            inviteNoteEl,
            readyBtnEl
          ]);

          if (deckBlock && deckBlock.parentNode === slides) {
            slides.insertBefore(partyEl, deckBlock);
          } else {
            slides.appendChild(partyEl);
          }
        } else {
          partyEl = document.getElementById(PARTY_ID);
        }

        const closeRaceIfDuoActivated = () => {
          if (suppressDuoObserver) return;
          const duoNode = findDuoCard();
          if (duoNode && duoNode.classList && duoNode.classList.contains('forceoff')) return;
          if (!cardSelected && !session) return;
          clearCardSpin();
          cardSelected = false;
          teardownRaceSession(true);
        };

        const duoCardNode = findDuoCard();
        if (duoCardNode && !duoCardNode.__twfoxRaceSyncBound) {
          duoCardNode.__twfoxRaceSyncBound = true;
          duoCardNode.addEventListener('click', closeRaceIfDuoActivated, true);
        }
        if (deckCards && !deckCards.__twfoxRaceDuoDelegateBound) {
          deckCards.__twfoxRaceDuoDelegateBound = true;
          deckCards.addEventListener('click', (ev) => {
            if (!cardSelected && !session) return;
            const duoNode = findDuoCard();
            if (!duoNode || !ev || !ev.target) return;
            let cur = ev.target;
            while (cur && cur !== deckCards) {
              if (cur === duoNode) {
                closeRaceIfDuoActivated();
                return;
              }
              cur = cur.parentNode;
            }
          }, true);
        }
        if (typeof root.MutationObserver === 'function') {
          if (zMenu && observedZMenuForDuo !== zMenu) {
            observedZMenuForDuo = zMenu;
            if (!duoClassObserver) {
              duoClassObserver = new root.MutationObserver(() => {
                if (!suppressDuoObserver && (cardSelected || session) && isDuoActiveNow()) {
                  closeRaceIfDuoActivated();
                }
              });
            }
            duoClassObserver.observe(zMenu, { attributes: true, attributeFilter: ['class'] });
          }
          if (duoCardNode && observedDuoCardForClass !== duoCardNode) {
            observedDuoCardForClass = duoCardNode;
            const cardObs = new root.MutationObserver(() => {
              if (!suppressDuoObserver && (cardSelected || session) && isDuoActiveNow()) {
                closeRaceIfDuoActivated();
              }
            });
            cardObs.observe(duoCardNode, { attributes: true, attributeFilter: ['class'] });
          }
        }

        bindLeaveZenithButton();
        syncVisualState();
        return true;
      } finally {
        isMountingDom = false;
      }
    }

    ensurePresenceWatch();
    ensureZenithDomMounted();

    if (typeof root.MutationObserver === 'function' && document.body) {
      const obs = new root.MutationObserver(() => {
        if (isMountingDom) return;
        const deckCards = document.getElementById('zenith_deck_cards');
        if (deckCards && (!document.getElementById(CARD_ID) || !document.getElementById(PARTY_ID))) {
          ensureZenithDomMounted();
        }
      });
      obs.observe(document.body, { childList: true, subtree: true });
    }

    api.subscribe(() => {
      ensurePresenceWatch();
      bindLeaveZenithButton();
      if (!document.getElementById(CARD_ID) || !document.getElementById(PARTY_ID)) {
        ensureZenithDomMounted();
      } else if (cardSelected && getSelfUsername() !== lastRenderedSelfName) {
        renderParty();
      }
      const rStateNow = api.getState ? api.getState() : null;
      const inZenithNow = Boolean(document.body && document.body.classList && document.body.classList.contains('inzenith'));
      const inGameNow = Boolean(
        (document.body && document.body.classList && document.body.classList.contains('ingame_phys')) ||
        (!inZenithNow && ((rStateNow && rStateNow.inGame) || (document.body && document.body.classList && document.body.classList.contains('ingame'))))
      );
      if (!session) {
        hasSeenZenithVisibleForSession = false;
      } else if (!inGameNow && (racePhase === 'idle' || racePhase === 'countdown')) {
        if (isInQuickPlayLobbyUi()) {
          hasSeenZenithVisibleForSession = true;
        } else if (hasSeenZenithVisibleForSession) {
          triggerLeaveQuickPlayCleanup();
        }
      }
      if (racePhase === 'entering' || racePhase === 'alive') {
        sampleAndBroadcastLocalRun();
      } else if (racePhase === 'dead') {
        renderSpectator();
      }
    });

    if (typeof document.addEventListener === 'function') {
      document.addEventListener('click', (ev) => {
        if (!session) return;
        const tgt = ev && ev.target;
        if (!tgt) return;

        if (!allowProgrammaticRaceStart && isNewGameLaunchBlocked()) {
          const startBtn = document.getElementById('start_zenith');
          const partyReadyBtn = document.getElementById('zenith_party_ready');
          const isStartHit =
            tgt.id === 'start_zenith' ||
            tgt === startBtn ||
            tgt.id === 'zenith_party_ready' ||
            tgt === partyReadyBtn ||
            (typeof tgt.closest === 'function' && (tgt.closest('#start_zenith') || tgt.closest('#zenith_party_ready')));
          if (isStartHit) {
            if (typeof ev.preventDefault === 'function') ev.preventDefault();
            if (typeof ev.stopPropagation === 'function') ev.stopPropagation();
            if (typeof ev.stopImmediatePropagation === 'function') ev.stopImmediatePropagation();
            statusOverride = 'Finish the current Race round first.';
            return;
          }
        }

        const leaveBtn = document.getElementById('leavezenith');
        if (
          tgt.id === 'leavezenith' ||
          tgt === leaveBtn ||
          (typeof tgt.closest === 'function' && tgt.closest('#leavezenith'))
        ) {
          triggerLeaveQuickPlayCleanup();
        }
      }, true);

      const handleBlockedRaceKey = (ev) => {
        if (!isNewGameLaunchBlocked() || !ev) return;
        const codeUp = String(ev.code || '').toUpperCase();
        const keyUp = String(ev.key || '').toUpperCase();
        if (ev.ctrlKey || ev.metaKey || ev.altKey || /^F\d{1,2}$/.test(codeUp) || /^F\d{1,2}$/.test(keyUp)) {
          return;
        }
        const retryKeys = readUserRetryKeySet();
        const isRetryOrConfirm =
          retryKeys.has(codeUp) ||
          retryKeys.has(keyUp) ||
          codeUp === 'ENTER' ||
          codeUp === 'NUMPADENTER' ||
          codeUp === 'SPACE' ||
          keyUp === 'ENTER' ||
          keyUp === ' ';
        if (isOverlayKeyboardLocked() || isRetryOrConfirm) {
          if (typeof ev.preventDefault === 'function') ev.preventDefault();
          if (typeof ev.stopPropagation === 'function') ev.stopPropagation();
          if (typeof ev.stopImmediatePropagation === 'function') ev.stopImmediatePropagation();
        }
      };

      document.addEventListener('keydown', handleBlockedRaceKey, true);
      document.addEventListener('keyup', handleBlockedRaceKey, true);
      if (typeof root.addEventListener === 'function' && root !== document) {
        root.addEventListener('keydown', handleBlockedRaceKey, true);
        root.addEventListener('keyup', handleBlockedRaceKey, true);
      }
    }

    if (typeof root.addEventListener === 'function') {
      root.addEventListener('resize', () => {
        if (racePhase === 'alive') renderDock();
      });
      root.addEventListener('beforeunload', () => teardownRaceSession(false));
      root.addEventListener('pagehide', () => teardownRaceSession(false));
    }

    internals.zenRace = {
      getState() {
        return {
          cardSelected,
          racePhase,
          spectatingTargetId,
          peekMyResult,
          session: session ? session.getSnapshot() : null
        };
      },
      selectRaceCard,
      joinByInviteCode: joinRaceByCode,
      sendRaceInvite,
      setSpectateTarget(targetId) {
        spectatingTargetId = targetId || null;
        peekMyResult = false;
        renderSpectator();
      },
      refresh: ensureZenithDomMounted
    };
  }

  api.registerFeature('zen-race', initZenRace);
}(typeof globalThis !== 'undefined' ? globalThis : window));
