import React, { useEffect, useState } from 'react';
import { Volume2, VolumeX, RefreshCw, HelpCircle, Trophy, Zap, AlertTriangle, Bike } from 'lucide-react';
import confetti from 'canvas-confetti';
import { audioEngine } from '../audio/AudioEngine';
import type { PhysicsState } from '../game/PhysicsEngine';

interface HUDProps {
  physicsState: PhysicsState;
  score: number;
  multiplier: number;
  bestScore: number;
  bestDistance: number;
  currentBikeName: string;
  currentBikeColor: string;
  onRestart: () => void;
  onOpenGarage: () => void;
}

export const HUD: React.FC<HUDProps> = ({
  physicsState,
  score,
  multiplier,
  bestScore,
  bestDistance,
  currentBikeName,
  currentBikeColor,
  onRestart,
  onOpenGarage,
}) => {
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [showControls, setShowControls] = useState<boolean>(false);
  const [newRecordAlert, setNewRecordAlert] = useState<boolean>(false);

  const currentDistance = Math.max(0, Math.floor(physicsState.positionZ));

  // Trigger confetti when score breaks bestScore
  useEffect(() => {
    if (score > 0 && score > bestScore && !newRecordAlert) {
      setNewRecordAlert(true);
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 },
      });
    }
  }, [score, bestScore, newRecordAlert]);

  const toggleSound = () => {
    const muted = audioEngine.toggleMute();
    setIsMuted(muted);
  };

  const pitchDegClamped = Math.min(90, Math.max(0, physicsState.pitchDeg));
  const anglePercent = (pitchDegClamped / 90) * 100;

  return (
    <div className="game-hud-container">
      {/* --- TOP BAR: Scores & Records --- */}
      <div className="hud-top-bar">
        {/* Score & Multiplier */}
        <div className="glass-card score-card">
          <div className="hud-label">ĐIỂM SỐ WHEELIE</div>
          <div className="hud-score-value">
            {Math.floor(score).toLocaleString('vi-VN')}
            {multiplier > 1 && (
              <span className={`multiplier-badge ${multiplier >= 5 ? 'max-multiplier' : ''}`}>
                x{multiplier} <Zap className="zap-icon" />
              </span>
            )}
          </div>
        </div>

        {/* Distance Tracked */}
        <div className="glass-card distance-card">
          <div className="hud-label">QUÃNG ĐƯỜNG</div>
          <div className="hud-value">{currentDistance} <span className="unit">m</span></div>
        </div>

        {/* High Score Record */}
        <div className="glass-card record-card">
          <div className="hud-label"><Trophy className="trophy-icon" /> KỶ LỤC DẪN ĐẦU</div>
          <div className="record-details">
            <div>Score: <span>{Math.floor(bestScore).toLocaleString('vi-VN')}</span></div>
            <div>Xa nhất: <span>{bestDistance} m</span></div>
          </div>
        </div>

        {/* Current Bike & Garage Button */}
        <div className="top-controls">
          <button
            className="garage-trigger-btn"
            onClick={onOpenGarage}
            title="Mở Garage đổi xe (G)"
          >
            <Bike className="garage-bike-icon" style={{ color: currentBikeColor }} />
            <div className="garage-btn-text">
              <span className="garage-btn-title">GARAGE</span>
              <span className="garage-btn-model" style={{ color: currentBikeColor }}>{currentBikeName}</span>
            </div>
          </button>

          <button className="icon-btn" onClick={toggleSound} title="Tắt/Bật âm thanh">
            {isMuted ? <VolumeX className="text-red-400" /> : <Volume2 className="text-cyan-400" />}
          </button>
          <button className="icon-btn" onClick={() => setShowControls(!showControls)} title="Hướng dẫn phím">
            <HelpCircle />
          </button>
          <button className="icon-btn restart-btn" onClick={onRestart} title="Thử lại (R)">
            <RefreshCw />
          </button>
        </div>
      </div>

      {/* --- BOTTOM HUD: Gauges (Speedometer & Wheelie Pitch Angle) --- */}
      <div className="hud-bottom-bar">
        {/* Wheelie Pitch Angle Arch Gauge */}
        <div className="glass-card pitch-gauge-card">
          <div className="gauge-header">
            <span>GÓC BỐC ĐẦU (PITCH)</span>
            <span className={`pitch-deg-text ${physicsState.isSweetSpot ? 'text-sweet' : ''} ${physicsState.isScrapingFender ? 'text-scrape' : ''}`}>
              {Math.round(physicsState.pitchDeg)}°
            </span>
          </div>

          {/* Angle Visual Progress Bar */}
          <div className="pitch-bar-container">
            {/* Zones */}
            <div className="zone normal-zone" style={{ width: '48%' }} title="0° - 44°: Bốc đầu nhẹ" />
            <div className="zone sweet-zone" style={{ width: '34%' }} title="45° - 75°: SWEET SPOT (Nhân điểm)" />
            <div className="zone scrape-zone" style={{ width: '14%' }} title="76° - 89°: Quẹt đuôi xe!" />
            <div className="zone danger-zone" style={{ width: '4%' }} title="90°+: LỘN NGỬA TAI NẠN!" />

            {/* Indicator Marker */}
            <div
              className="pitch-indicator-marker"
              style={{ left: `${Math.min(98, Math.max(2, anglePercent))}%` }}
            />
          </div>

          <div className="pitch-status-msg">
            {physicsState.isSweetSpot && <span className="status-sweet">🔥 SWEET SPOT! ĐANG NHÂN X{multiplier} ĐIỂM!</span>}
            {physicsState.isScrapingFender && <span className="status-scrape">⚡ QUẸT ĐUÔI XE! BẮN TIA LỬA ĐIỆN!</span>}
            {!physicsState.isWheelieActive && <span className="status-idle">Bấm [W] + [Space] để bốc đầu!</span>}
          </div>
        </div>

        {/* Speedometer */}
        <div className="glass-card speed-card">
          <div className="speed-number">{physicsState.speedKmh}</div>
          <div className="speed-unit">KM/H</div>
        </div>
      </div>

      {/* --- CRASH OVERLAY SCREEN (LỘN ĐẰNG SAU / NGÃ XE) --- */}
      {physicsState.isCrashed && (
        <div className="crash-modal-overlay">
          <div className="glass-modal crash-modal">
            <div className="crash-header">
              <AlertTriangle className="crash-warning-icon" />
              <h2>NGÃ XE RỒI!</h2>
            </div>

            <p className="crash-reason">{physicsState.crashReason}</p>

            <div className="crash-stats-grid">
              <div className="stat-box">
                <span className="stat-title">Điểm Lượt Này</span>
                <span className="stat-val">{Math.floor(score).toLocaleString('vi-VN')}</span>
              </div>
              <div className="stat-box">
                <span className="stat-title">Quãng Đường</span>
                <span className="stat-val">{currentDistance} m</span>
              </div>
            </div>

            {newRecordAlert && (
              <div className="new-record-banner">
                🏆 BẠN VỪA PHÁ KỶ LỤC ĐIỂM MỚI!
              </div>
            )}

            <button className="big-restart-btn" onClick={onRestart}>
              <RefreshCw className="spin-icon-on-hover" /> BỐC LAI NGAY (Phím R)
            </button>
          </div>
        </div>
      )}

      {/* --- CONTROLS MODAL --- */}
      {showControls && (
        <div className="controls-modal-overlay" onClick={() => setShowControls(false)}>
          <div className="glass-modal controls-modal" onClick={(e) => e.stopPropagation()}>
            <h3>🎮 HƯỚNG DẪN ĐIỀU KHIỂN BỐC ĐẦU</h3>
            <ul className="controls-list">
              <li><kbd>W</kbd> hoặc <kbd>↑</kbd> : <strong>Tăng ga (Throttle)</strong> - Tăng tốc & tạo gia tốc nâng đầu xe. Giữ quá lâu góc vượt 90° sẽ ngã!</li>
              <li><kbd>S</kbd> hoặc <kbd>↓</kbd> : <strong>Phanh sau (Rear Brake)</strong> - Ghì bánh trước xuống gấp để tránh lộn ngửa quá 90°!</li>
              <li><kbd>Space</kbd> / <kbd>Shift</kbd> : <strong>Kéo nghiêng về sau (Lean Back)</strong> - Tăng góc bốc đầu xe.</li>
              <li><kbd>A</kbd> / <kbd>D</kbd> : <strong>Lái nghiêng (Steer)</strong> - Rẽ trái / rẽ phải tự do trên bình nguyên.</li>
              <li><kbd>Chuột</kbd> : <strong>Kéo chuột xoay góc nhìn</strong> - Thả chuột tự động quay về sau đuôi xe.</li>
              <li><kbd>G</kbd> : <strong>Garage (Chọn xe)</strong> - Đổi mẫu cào cào (Fantic, Kawasaki, Yamaha).</li>
              <li><kbd>R</kbd> : <strong>Thử lại nhanh (Quick Restart)</strong>.</li>
            </ul>
            <button className="close-btn" onClick={() => setShowControls(false)}>Đóng</button>
          </div>
        </div>
      )}
    </div>
  );
};
