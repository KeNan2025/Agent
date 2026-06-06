/**
 * 历史回溯组件 - 时间轴回放
 */

import { useState, useEffect } from 'react';
import { Card, Slider, Button, Space, Select, DatePicker, Row, Col, Statistic } from 'antd';
import {
  PlayCircleOutlined,
  PauseCircleOutlined,
  StepBackwardOutlined,
  StepForwardOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import type { Dayjs } from 'dayjs';
import dayjs from 'dayjs';

interface HistoryPlaybackProps {
  historyRange: { start: number; end: number } | null;
  currentTime: number;
  isPlaying: boolean;
  playbackSpeed: number;
  onTimeChange: (time: number) => void;
  onPlay: () => void;
  onPause: () => void;
  onSpeedChange: (speed: number) => void;
  onReset: () => void;
}

const SPEED_OPTIONS = [
  { value: 0.5, label: '0.5x' },
  { value: 1, label: '1x' },
  { value: 2, label: '2x' },
  { value: 5, label: '5x' },
  { value: 10, label: '10x' },
];

export default function HistoryPlayback({
  historyRange,
  currentTime,
  isPlaying,
  playbackSpeed,
  onTimeChange,
  onPlay,
  onPause,
  onSpeedChange,
  onReset,
}: HistoryPlaybackProps) {
  const [sliderValue, setSliderValue] = useState(0);
  const [selectedDate, setSelectedDate] = useState<Dayjs | null>(null);

  useEffect(() => {
    if (historyRange) {
      const progress = ((currentTime - historyRange.start) / (historyRange.end - historyRange.start)) * 100;
      setSliderValue(Math.max(0, Math.min(100, progress)));
    }
  }, [currentTime, historyRange]);

  const handleSliderChange = (value: number) => {
    if (!historyRange) return;
    const time = historyRange.start + ((historyRange.end - historyRange.start) * value) / 100;
    onTimeChange(time);
  };

  const handleStepBackward = () => {
    if (!historyRange) return;
    const step = (historyRange.end - historyRange.start) * 0.01; // 1%步进
    const newTime = Math.max(historyRange.start, currentTime - step);
    onTimeChange(newTime);
  };

  const handleStepForward = () => {
    if (!historyRange) return;
    const step = (historyRange.end - historyRange.start) * 0.01;
    const newTime = Math.min(historyRange.end, currentTime + step);
    onTimeChange(newTime);
  };

  const handleDateChange = (date: Dayjs | null) => {
    if (!date || !historyRange) return;
    setSelectedDate(date);
    const timestamp = date.valueOf();
    if (timestamp >= historyRange.start && timestamp <= historyRange.end) {
      onTimeChange(timestamp);
    }
  };

  const formatTime = (timestamp: number): string => {
    return dayjs(timestamp).format('YYYY-MM-DD HH:mm:ss');
  };

  const formatDuration = (ms: number): string => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}小时${minutes % 60}分钟`;
    } else if (minutes > 0) {
      return `${minutes}分钟${seconds % 60}秒`;
    } else {
      return `${seconds}秒`;
    }
  };

  if (!historyRange) {
    return (
      <Card>
        <div style={{ textAlign: 'center', padding: '40px 0', color: '#6b7280' }}>
          暂无历史数据
        </div>
      </Card>
    );
  }

  const duration = historyRange.end - historyRange.start;

  return (
    <Card
      title="历史回溯"
      extra={
        <Space>
          <Select
            value={playbackSpeed}
            onChange={onSpeedChange}
            options={SPEED_OPTIONS}
            style={{ width: 80 }}
            size="small"
          />
          <Button
            icon={<ReloadOutlined />}
            onClick={onReset}
            size="small"
          >
            重置
          </Button>
        </Space>
      }
    >
      {/* 时间信息 */}
      <Row gutter={16} style={{ marginBottom: 20 }}>
        <Col span={8}>
          <Statistic
            title="开始时间"
            value={formatTime(historyRange.start)}
            valueStyle={{ fontSize: '14px' }}
          />
        </Col>
        <Col span={8}>
          <Statistic
            title="当前时间"
            value={formatTime(currentTime)}
            valueStyle={{ fontSize: '14px', color: '#3b82f6' }}
          />
        </Col>
        <Col span={8}>
          <Statistic
            title="结束时间"
            value={formatTime(historyRange.end)}
            valueStyle={{ fontSize: '14px' }}
          />
        </Col>
      </Row>

      {/* 时间轴滑块 */}
      <div style={{ marginBottom: 20 }}>
        <Slider
          value={sliderValue}
          onChange={handleSliderChange}
          tooltip={{
            formatter: (value) => {
              if (!value) return '';
              const time = historyRange.start + ((historyRange.end - historyRange.start) * value) / 100;
              return formatTime(time);
            },
          }}
          disabled={isPlaying}
        />
      </div>

      {/* 控制按钮 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px' }}>
        <Button
          icon={<StepBackwardOutlined />}
          onClick={handleStepBackward}
          disabled={isPlaying || currentTime <= historyRange.start}
        />

        {isPlaying ? (
          <Button
            type="primary"
            icon={<PauseCircleOutlined />}
            onClick={onPause}
            size="large"
          >
            暂停
          </Button>
        ) : (
          <Button
            type="primary"
            icon={<PlayCircleOutlined />}
            onClick={onPlay}
            size="large"
            disabled={currentTime >= historyRange.end}
          >
            播放
          </Button>
        )}

        <Button
          icon={<StepForwardOutlined />}
          onClick={handleStepForward}
          disabled={isPlaying || currentTime >= historyRange.end}
        />
      </div>

      {/* 快速跳转 */}
      <div style={{ marginTop: 20, display: 'flex', alignItems: 'center', gap: '12px' }}>
        <span style={{ fontSize: '13px', color: '#6b7280' }}>快速跳转:</span>
        <DatePicker
          showTime
          value={selectedDate}
          onChange={handleDateChange}
          format="YYYY-MM-DD HH:mm:ss"
          style={{ flex: 1 }}
          size="small"
          disabledDate={(date) => {
            const timestamp = date.valueOf();
            return timestamp < historyRange.start || timestamp > historyRange.end;
          }}
        />
      </div>

      {/* 统计信息 */}
      <div
        style={{
          marginTop: 16,
          padding: '12px',
          background: '#f9fafb',
          borderRadius: '6px',
          display: 'flex',
          justifyContent: 'space-around',
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '12px', color: '#6b7280' }}>历史跨度</div>
          <div style={{ fontSize: '16px', fontWeight: 600, color: '#1f2937', marginTop: '4px' }}>
            {formatDuration(duration)}
          </div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '12px', color: '#6b7280' }}>播放速度</div>
          <div style={{ fontSize: '16px', fontWeight: 600, color: '#1f2937', marginTop: '4px' }}>
            {playbackSpeed}x
          </div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '12px', color: '#6b7280' }}>播放进度</div>
          <div style={{ fontSize: '16px', fontWeight: 600, color: '#1f2937', marginTop: '4px' }}>
            {sliderValue.toFixed(1)}%
          </div>
        </div>
      </div>
    </Card>
  );
}
