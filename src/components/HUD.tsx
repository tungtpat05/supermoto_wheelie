import React, { useState } from 'react';
import { audioEngine } from '../audio/AudioEngine';
import { BIKES_DATABASE } from '../game/BikeConfigs';
import { QUALITY_PRESETS, type GraphicsQuality } from '../game/GraphicsQuality';
import type { PhysicsState } from '../game/PhysicsEngine';
import type { WheelieHistoryRecord } from '../game/WheelieHistory';

interface HUDProps {
  physicsState: PhysicsState;
  measuredPitchDeg: number;
  fps: number;
  engineRunning: boolean;
  enginePrompt: boolean;
  quality: GraphicsQuality;
  onQualityChange: (quality: GraphicsQuality) => void;
  selectedBikeId: string;
  onBikeChange: (id: string) => void;
  isBikeLoading: boolean;
  loadProgress: number;
  bikeError: string;
  onRestart: () => void;
  wheelieHistory: WheelieHistoryRecord[];
  bestWheelie: number;
}

const formatRecordTime = (timestamp: number) => {
  const date = new Date(timestamp);
  return [date.getHours(), date.getMinutes(), date.getSeconds()]
    .map(value => value.toString().padStart(2, '0'))
    .join(':');
};

export const HUD: React.FC<HUDProps> = ({
  physicsState, measuredPitchDeg, fps, engineRunning, enginePrompt, quality, onQualityChange, selectedBikeId, onBikeChange,
  isBikeLoading, loadProgress, bikeError, onRestart,
  wheelieHistory, bestWheelie,
}) => {
  const [isMuted, setIsMuted] = useState(() => audioEngine.getMuted());
  const pitch = Math.min(90, Math.max(0, measuredPitchDeg));
  const status = physicsState.isCrashed ? 'Đã ngã xe'
    : pitch >= 76 ? 'Quẹt đuôi · giảm góc bốc'
    : pitch >= 45 && pitch <= 75 ? 'Giữ thăng bằng'
    : pitch > 0 ? 'Đang bốc đầu' : 'Bánh trước chạm đất';

  return (
    <div className="ride-hud" onPointerDown={e => e.stopPropagation()} onWheel={e => e.stopPropagation()}>
      <div className="ride-top">
        <div className="hud-panel ride-distance" title="Quãng đường mỗi lần bốc đầu. Về 0 khi bánh trước chạm đất.">
          <span className="hud-caption">QUÃNG ĐƯỜNG</span>
          <span className="distance-number" data-testid="wheelie-distance">{physicsState.wheelieDistance.toFixed(1)} <small>m</small></span>
        </div>
        <nav className="ride-menu" aria-label="Cài đặt trò chơi">
          <div className="hud-panel menu-item fps-item" aria-label="Tốc độ khung hình">
            <span className="hud-caption">FPS</span><span className="fps-number">{fps || '—'}</span>
          </div>
          <label className="hud-panel menu-item">
            <span className="hud-caption">QUALITY</span>
            <select aria-label="Quality" value={quality} onChange={e => onQualityChange(e.target.value as GraphicsQuality)}>
              {Object.keys(QUALITY_PRESETS).map(level => <option key={level} value={level}>{level}</option>)}
            </select>
          </label>
          <label className="hud-panel menu-item bike-item">
            <span className="hud-caption">BIKE</span>
            <select aria-label="Bike" value={selectedBikeId} disabled={isBikeLoading} onChange={e => onBikeChange(e.target.value)}>
              {BIKES_DATABASE.map(bike => <option key={bike.id} value={bike.id}>{bike.name}</option>)}
            </select>
          </label>
          <div className="hud-panel menu-item">
            <span className="hud-caption">SOUND</span>
            <button type="button" aria-label="Âm thanh" aria-pressed={!isMuted} onClick={() => {
              audioEngine.init();
              setIsMuted(audioEngine.toggleMute());
            }}>{isMuted ? 'Off' : 'On'}</button>
            <span className={`engine-state ${engineRunning ? 'engine-on' : ''}`}>ENGINE {engineRunning ? 'ON' : 'OFF'}</span>
          </div>
        </nav>
        {(isBikeLoading || bikeError) && <div className="hud-panel bike-notice" role="status">
          {isBikeLoading ? `Đang tải xe · ${Math.round(loadProgress)}%` : bikeError}
        </div>}
      </div>
      <section className="hud-panel ride-history" aria-label="Lịch sử bốc đầu">
        <div className="history-best">
          <span className="hud-caption">BEST WHEELIE</span>
          <strong>Best: {bestWheelie.toFixed(1)} <small>m</small></strong>
        </div>
        <div className="history-list" aria-live="polite">
          {wheelieHistory.length === 0 ? (
            <span className="history-empty">Chưa có lần bốc đầu</span>
          ) : wheelieHistory.map((record, index) => (
            <div className="history-record" key={`${record.timestamp}-${index}`}>
              <time dateTime={new Date(record.timestamp).toISOString()}>{formatRecordTime(record.timestamp)}:</time>
              <span>{record.distance.toFixed(1)} m</span>
            </div>
          ))}
        </div>
      </section>
      {enginePrompt && <div className="engine-prompt" role="status">Nhấn <kbd>Shift</kbd> để bật động cơ</div>}

      <div className="ride-bottom-left">
        <section className="hud-panel ride-pitch" aria-label="Góc bốc đầu">
          <div className="pitch-heading"><span className="hud-caption">GÓC BỐC ĐẦU <span className="pitch-en">/ PITCH</span></span><strong>{Math.round(pitch)}°</strong></div>
          <div className="pitch-track" role="meter" aria-label="Góc bốc đầu" aria-valuenow={Math.round(pitch)} aria-valuemin={0} aria-valuemax={90}>
            <span className="pitch-safe-zone" />
            <span className="pitch-needle" style={{ left: `${Math.min(99, Math.max(1, pitch / 90 * 100))}%` }} />
          </div>
          <div className="pitch-foot"><span className={physicsState.isScrapingFender ? 'pitch-warning' : ''}>{status}</span><span>90°</span></div>
        </section>
        <div className="hud-panel ride-help" aria-label="Hướng dẫn phím">
          <span className="help-mark" title="Hướng dẫn phím">?</span>
          <span><kbd>W / ↑</kbd> — Ga</span>
          <span><kbd>S / ↓</kbd> — Phanh</span>
          <span><kbd>A / D</kbd> — Lái</span>
          <span><kbd>Shift</kbd> — Bật/tắt động cơ</span>
          <span><kbd>Kéo chuột</kbd> — Xoay</span>
          <span><kbd>Cuộn</kbd> — Zoom</span>
          <button type="button" onClick={onRestart} title="Thử lại (R)"><kbd>R</kbd> — Thử lại</button>
        </div>
      </div>
      <div className="hud-panel ride-speed" aria-label="Vận tốc"><strong>{physicsState.speedKmh}</strong><span className="hud-caption">KM/H</span></div>

      {physicsState.isCrashed && <div className="ride-crash-overlay">
        <section className="hud-panel ride-crash" role="dialog" aria-modal="true" aria-labelledby="crash-title">
          <span className="hud-caption">THỬ LẠI MỘT VÒNG</span>
          <h2 id="crash-title">Ngã xe rồi!</h2>
          <p>{physicsState.crashReason}</p>
          <button type="button" autoFocus onClick={onRestart}>Chạy lại <kbd>R</kbd></button>
        </section>
      </div>}
    </div>
  );
};
