import { DateTime } from 'luxon';
import {
  listDevices,
  findDevice,
  renameDevice,
  setDeviceExcludeFromStats,
  deleteDevice,
  deletePlaysByDevice,
  normalizeDeviceId,
} from '../repositories/deviceRepository.js';
import { countUnattributedPlays } from '../repositories/playHistoryRepository.js';
import { getPlayHistoryStorageZone } from '../lib/playHistoryTime.js';

export async function getDevicesHandler(request, reply) {
  try {
    return {
      success: true,
      data: {
        devices: listDevices(),
        // device_id가 없는 옛 기록 — UI에서 '기기 미상'으로 묶어 보여준다
        unattributedPlays: countUnattributedPlays(),
      },
    };
  } catch (err) {
    request.log.error(err);
    return reply.code(500).send({ success: false, error: '기기 목록 조회 중 오류가 발생했습니다.' });
  }
}

export async function patchDeviceHandler(request, reply) {
  const id = normalizeDeviceId(request.params?.id);
  if (!id) return reply.code(400).send({ success: false, error: 'deviceId가 필요합니다.' });
  if (!findDevice(id)) return reply.code(404).send({ success: false, error: 'Device not found' });

  const body = request.body && typeof request.body === 'object' ? request.body : {};

  try {
    if (Object.prototype.hasOwnProperty.call(body, 'name')) {
      const name = String(body.name ?? '').trim();
      if (!name) {
        return reply.code(400).send({ success: false, error: '기기 이름을 입력해주세요.' });
      }
      renameDevice(id, name);
    }
    if (Object.prototype.hasOwnProperty.call(body, 'excludeFromStats')) {
      setDeviceExcludeFromStats(id, !!body.excludeFromStats);
    }
    return { success: true, data: findDevice(id) };
  } catch (err) {
    request.log.error(err);
    return reply.code(500).send({ success: false, error: '기기 수정 중 오류가 발생했습니다.' });
  }
}

export async function deleteDeviceHandler(request, reply) {
  const id = normalizeDeviceId(request.params?.id);
  if (!id) return reply.code(400).send({ success: false, error: 'deviceId가 필요합니다.' });
  try {
    const changes = deleteDevice(id);
    if (!changes) return reply.code(404).send({ success: false, error: 'Device not found' });
    // play_history.device_id는 소프트 참조 — 기록은 '기기 미상'으로 남는다
    return { success: true, data: { id } };
  } catch (err) {
    request.log.error(err);
    return reply.code(500).send({ success: false, error: '기기 삭제 중 오류가 발생했습니다.' });
  }
}

/**
 * 사용자 로컬 날짜(YYYY-MM-DD)를 저장 타임존 경계 문자열로 변환.
 * from은 그날 00:00:00, to는 그날 23:59:59를 포함하도록 만든다.
 */
function boundaryString(dateStr, timezone, edge) {
  const raw = String(dateStr ?? '').trim();
  if (!raw) return null;
  const base = DateTime.fromISO(raw, { zone: timezone });
  if (!base.isValid) return null;
  const dt = edge === 'end' ? base.endOf('day') : base.startOf('day');
  return dt.setZone(getPlayHistoryStorageZone()).toFormat('yyyy-MM-dd HH:mm:ss');
}

/** 특정 기기의 재생 기록 삭제 (기간 선택 가능) */
export async function deleteDevicePlaysHandler(request, reply) {
  const id = normalizeDeviceId(request.params?.id);
  if (!id) return reply.code(400).send({ success: false, error: 'deviceId가 필요합니다.' });

  const body = request.body && typeof request.body === 'object' ? request.body : {};
  const timezone = String(body.timezone || 'UTC');

  const from = boundaryString(body.from, timezone, 'start');
  const to = boundaryString(body.to, timezone, 'end');
  if (body.from && !from) {
    return reply.code(400).send({ success: false, error: 'from 날짜 형식이 올바르지 않습니다.' });
  }
  if (body.to && !to) {
    return reply.code(400).send({ success: false, error: 'to 날짜 형식이 올바르지 않습니다.' });
  }

  try {
    const result = deletePlaysByDevice({ deviceId: id, from, to });
    request.log.info({ deviceId: id, from, to, ...result }, 'play history deleted by device');
    return { success: true, data: result };
  } catch (err) {
    request.log.error(err);
    return reply.code(500).send({ success: false, error: '재생 기록 삭제 중 오류가 발생했습니다.' });
  }
}
