import React, { useState } from 'react';
import { X, Check, Gauge, Zap, Shield, Flame, Volume2, Sparkles } from 'lucide-react';
import { BIKES_DATABASE, type BikeConfig } from '../game/BikeConfigs';
import { audioEngine } from '../audio/AudioEngine';

interface GarageModalProps {
  currentBikeId: string;
  onSelectBike: (bikeId: string) => void;
  onClose: () => void;
  isLoading?: boolean;
  loadProgress?: number;
}

export const GarageModal: React.FC<GarageModalProps> = ({
  currentBikeId,
  onSelectBike,
  onClose,
  isLoading = false,
  loadProgress = 0,
}) => {
  const [selectedPreviewId, setSelectedPreviewId] = useState<string>(currentBikeId);

  const activeBike = BIKES_DATABASE.find((b) => b.id === selectedPreviewId) || BIKES_DATABASE[0];
  const isCurrentlyEquipped = currentBikeId === activeBike.id;

  const handleTestSound = (bike: BikeConfig) => {
    audioEngine.setSoundProfile(bike.soundType);
    audioEngine.previewRev();
  };

  const handleEquip = () => {
    if (!isCurrentlyEquipped) {
      onSelectBike(activeBike.id);
    }
  };

  return (
    <div className="garage-modal-overlay" onClick={onClose}>
      <div className="glass-modal garage-modal-content" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="garage-header">
          <div className="garage-title-wrap">
            <span className="garage-badge"><Sparkles size={14} /> GARAGE XE ĐUA</span>
            <h2>CHỌN MẪU XE WHEELIE</h2>
          </div>
          <button className="icon-btn close-garage-btn" onClick={onClose} title="Đóng Garage">
            <X size={20} />
          </button>
        </div>

        {/* Loading Progress Bar if switching */}
        {isLoading && (
          <div className="garage-loading-bar-wrap">
            <div className="garage-loading-text">
              <span>Đang chuẩn bị mô hình 3D...</span>
              <span>{loadProgress}%</span>
            </div>
            <div className="garage-progress-track">
              <div className="garage-progress-fill" style={{ width: `${loadProgress}%` }} />
            </div>
          </div>
        )}

        {/* Main Content: Bike Cards List & Details Panel */}
        <div className="garage-body-grid">
          {/* Left: Bike Cards List */}
          <div className="garage-bikes-list">
            {BIKES_DATABASE.map((bike) => {
              const isSelected = bike.id === selectedPreviewId;
              const isEquipped = bike.id === currentBikeId;

              return (
                <div
                  key={bike.id}
                  className={`bike-select-card ${isSelected ? 'selected' : ''} ${isEquipped ? 'equipped' : ''}`}
                  onClick={() => setSelectedPreviewId(bike.id)}
                  style={{
                    borderColor: isSelected ? bike.color : undefined,
                    boxShadow: isSelected ? `0 0 20px ${bike.color}33` : undefined,
                  }}
                >
                  <div className="card-top-row">
                    <span className="bike-brand">{bike.brand}</span>
                    <div className="badge-group">
                      <span className="engine-badge" style={{ backgroundColor: `${bike.color}22`, color: bike.color }}>
                        {bike.engineCategory}
                      </span>
                      {isEquipped && (
                        <span className="equipped-badge">
                          <Check size={12} /> ĐANG DÙNG
                        </span>
                      )}
                    </div>
                  </div>

                  <h3 className="bike-card-name">{bike.name}</h3>
                  <div className="bike-card-engine">{bike.engine}</div>

                  <div className="bike-card-mini-stats">
                    <span>⚡ {bike.stats.power} HP</span>
                    <span>⚖️ {bike.stats.weightKg} kg</span>
                    <span>🚀 {bike.stats.topSpeedKmh} km/h</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Right: Selected Bike Detailed Specs */}
          <div className="garage-bike-details">
            <div className="details-header" style={{ borderLeftColor: activeBike.color }}>
              <div className="details-tagline">{activeBike.tagline}</div>
              <h1 className="details-bike-name">{activeBike.name}</h1>
              <p className="details-desc">{activeBike.description}</p>
            </div>

            {/* Performance Stats Bars */}
            <div className="specs-container">
              <div className="spec-row">
                <div className="spec-label">
                  <Flame size={16} color={activeBike.color} />
                  <span>Sức Mạnh & Gia Tốc</span>
                </div>
                <div className="spec-bar-wrap">
                  <div
                    className="spec-bar-fill"
                    style={{
                      width: `${activeBike.stats.power}%`,
                      backgroundColor: activeBike.color,
                    }}
                  />
                </div>
                <span className="spec-val">{activeBike.stats.power}%</span>
              </div>

              <div className="spec-row">
                <div className="spec-label">
                  <Zap size={16} color="#ffe600" />
                  <span>Độ Nhạy Bốc Đầu</span>
                </div>
                <div className="spec-bar-wrap">
                  <div
                    className="spec-bar-fill"
                    style={{
                      width: `${activeBike.stats.wheelieTorque}%`,
                      backgroundColor: '#ffe600',
                    }}
                  />
                </div>
                <span className="spec-val">{activeBike.stats.wheelieTorque}%</span>
              </div>

              <div className="spec-row">
                <div className="spec-label">
                  <Shield size={16} color="#10b981" />
                  <span>Độ Thăng Bằng (Sweet Spot)</span>
                </div>
                <div className="spec-bar-wrap">
                  <div
                    className="spec-bar-fill"
                    style={{
                      width: `${activeBike.stats.stability}%`,
                      backgroundColor: '#10b981',
                    }}
                  />
                </div>
                <span className="spec-val">{activeBike.stats.stability}%</span>
              </div>

              <div className="spec-row">
                <div className="spec-label">
                  <Gauge size={16} color="#00f0ff" />
                  <span>Tốc Độ Tối Đa</span>
                </div>
                <div className="spec-bar-wrap">
                  <div
                    className="spec-bar-fill"
                    style={{
                      width: `${(activeBike.stats.topSpeedKmh / 180) * 100}%`,
                      backgroundColor: '#00f0ff',
                    }}
                  />
                </div>
                <span className="spec-val">{activeBike.stats.topSpeedKmh} km/h</span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="details-actions">
              <button
                type="button"
                className="sound-test-btn"
                onClick={() => handleTestSound(activeBike)}
                title="Nghe thử tiếng pô"
              >
                <Volume2 size={18} /> Thử Tiếng Pô
              </button>

              <button
                type="button"
                className={`equip-bike-btn ${isCurrentlyEquipped ? 'is-active' : ''}`}
                style={{
                  backgroundColor: isCurrentlyEquipped ? 'rgba(255,255,255,0.1)' : activeBike.color,
                  boxShadow: isCurrentlyEquipped ? 'none' : `0 0 24px ${activeBike.color}66`,
                }}
                onClick={handleEquip}
                disabled={isLoading}
              >
                {isCurrentlyEquipped ? (
                  <>
                    <Check size={18} /> ĐANG SỬ DỤNG XE NÀY
                  </>
                ) : (
                  <>
                    <Zap size={18} /> CHỌN XE & RA ĐƯỜNG ĐUA
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
