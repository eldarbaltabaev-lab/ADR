// ═══════════════════════════════════════════════════════
//  DATA STORE
// ═══════════════════════════════════════════════════════
const CURRENT_USER = 'Admin';

let DB = {
  residents: [],
  assignments: [],
  history: [],
  nextId: 1,
  allRooms: [],
};

function save() {
  try {
    localStorage.setItem('turan_db_v2', JSON.stringify(DB));
  } catch (e) {}
}
function load() {
  try {
    const d = localStorage.getItem('turan_db_v2');
    if (d) DB = JSON.parse(d);
  } catch (e) {}
}
load();

function addHistory(action, detail, entityId = null, entityType = null) {
  DB.history.unshift({
    id: Date.now(),
    timestamp: new Date().toISOString(),
    user: CURRENT_USER,
    action: action,
    detail: detail,
    entityId: entityId,
    entityType: entityType,
  });
  if (DB.history.length > 500) DB.history = DB.history.slice(0, 500);
  save();
}

// ═══════════════════════════════════════════════════════
//  CLOCK & NAV
// ═══════════════════════════════════════════════════════
function tick() {
  const n = new Date();
  document.getElementById('clock').textContent =
    n.toLocaleDateString('ru-RU', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    }) +
    '  ' +
    n.toLocaleTimeString('ru-RU');
}
setInterval(tick, 1000);
tick();
document.getElementById('current-user').textContent = '👤 ' + CURRENT_USER;

function switchToPage(pageName) {
  document
    .querySelectorAll('nav a')
    .forEach((x) => x.classList.remove('active'));
  document
    .querySelectorAll('.page')
    .forEach((x) => x.classList.remove('active'));
  const navLink = document.querySelector(`[data-page="${pageName}"]`);
  if (navLink) navLink.classList.add('active');
  const page = document.getElementById('page-' + pageName);
  if (page) page.classList.add('active');

  const renderers = {
    dashboard: renderDashboard,
    blocks: () => {
      populateBlockSelect();
    },
    residents: () => {
      populateFilters();
      renderResidents();
    },
    assignments: renderAssignments,
    overtime: populateOvertimeFilters,
    history: renderHistory,
  };
  if (renderers[pageName]) renderers[pageName]();
}

document.querySelectorAll('nav a').forEach((a) => {
  a.addEventListener('click', () => switchToPage(a.dataset.page));
});

// ═══════════════════════════════════════════════════════
//  TOAST
// ═══════════════════════════════════════════════════════
function toast(msg, type = 'tok') {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = 'show ' + type;
  setTimeout(() => (el.className = ''), 2800);
}

// ═══════════════════════════════════════════════════════
//  HELPERS
// ═══════════════════════════════════════════════════════
function getEmployeeByEmpNumber(empNum) {
  return DB.residents.find((r) => r.emp_number === empNum);
}

function getEmployeeById(id) {
  return DB.residents.find((r) => r.id === id);
}

function getFloor(roomNum) {
  const n = parseInt(roomNum);
  if (n >= 100 && n < 200) return 1;
  if (n >= 200 && n < 300) return 2;
  if (n >= 300 && n < 400) return 3;
  return 0;
}

function getFloorColor(floor) {
  if (floor === 1) return 'var(--floor1)';
  if (floor === 2) return 'var(--floor2)';
  if (floor === 3) return 'var(--floor3)';
  return 'var(--muted)';
}

function getFloorName(floor) {
  if (floor === 1) return '1 этаж (100-199)';
  if (floor === 2) return '2 этаж (200-299)';
  if (floor === 3) return '3 этаж (300-399)';
  return 'Неизвестный этаж';
}

function getStatusBadge(status) {
  const map = {
    active: 'b-active',
    expected: 'b-expected',
    departed: 'b-departed',
  };
  const labels = {
    active: 'Проживает',
    expected: 'Ожидается',
    departed: 'Выехал',
  };
  return `<span class="badge ${map[status] || ''}">${
    labels[status] || status
  }</span>`;
}

function formatDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('ru-RU');
}

function getVacationProgress(resident) {
  if (!resident.arrive_date || !resident.depart_date) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const arrive = new Date(resident.arrive_date);
  arrive.setHours(0, 0, 0, 0);
  const depart = new Date(resident.depart_date);
  depart.setHours(0, 0, 0, 0);
  const total = Math.round((depart - arrive) / 86400000);
  const elapsed = Math.round((today - arrive) / 86400000);
  const remaining = Math.round((depart - today) / 86400000);
  if (total <= 0) return null;
  const pct = Math.min(100, Math.max(0, Math.round((elapsed / total) * 100)));
  let color = 'var(--green)';
  if (pct > 85) color = 'var(--red)';
  else if (pct > 65) color = 'var(--orange)';
  else if (pct > 40) color = 'var(--yellow)';
  return { pct, remaining, elapsed, total, color };
}

// ═══════════════════════════════════════════════════════
//  DASHBOARD
// ═══════════════════════════════════════════════════════
function renderDashboard() {
  document.getElementById('dash-date').textContent =
    new Date().toLocaleDateString('ru-RU', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const res = DB.residents;
  const active = res.filter((r) => r.status === 'active');
  const arriving = res.filter(
    (r) =>
      r.arrive_date &&
      new Date(r.arrive_date).toDateString() === today.toDateString() &&
      r.status !== 'departed'
  );
  const departing = res.filter(
    (r) =>
      r.depart_date &&
      new Date(r.depart_date).toDateString() === today.toDateString() &&
      r.status === 'active'
  );
  const expected = res.filter((r) => r.status === 'expected');

  document.getElementById('dash-stats').innerHTML = `
    <div class="stat" onclick="switchToPage('residents')"><div class="stat-val" style="color:var(--accent);">${res.length}</div><div class="stat-lbl">Всего сотрудников</div></div>
    <div class="stat" onclick="switchToPage('residents')"><div class="stat-val" style="color:var(--green);">${active.length}</div><div class="stat-lbl">Проживают сейчас</div></div>
    <div class="stat"><div class="stat-val" style="color:var(--yellow);">${arriving.length}</div><div class="stat-lbl">Заезжают сегодня 🚗</div></div>
    <div class="stat"><div class="stat-val" style="color:var(--purple);">${departing.length}</div><div class="stat-lbl">Выезжают сегодня ✈️</div></div>
    <div class="stat"><div class="stat-val" style="color:var(--orange);">${expected.length}</div><div class="stat-lbl">Ожидаются</div></div>
  `;

  // Today alerts
  const alertSection = document.getElementById('today-alerts-section');
  const alertDiv = document.getElementById('today-alerts');
  if (arriving.length > 0 || departing.length > 0) {
    alertSection.style.display = '';
    alertDiv.innerHTML = `
      <div style="display:flex;gap:12px;flex-wrap:wrap;">
        ${arriving
          .map(
            (r) => `
          <div style="background:rgba(247,212,79,.1);border:1px solid rgba(247,212,79,.3);border-radius:8px;padding:10px 14px;font-size:13px;cursor:pointer;" onclick="openEmployeeCard(${
            r.id
          })">
            🚗 <strong>${r.last_name} ${r.first_name}</strong> → Блок ${
              r.block || '?'
            }, комн. ${r.room || '?'}
          </div>
        `
          )
          .join('')}
        ${departing
          .map(
            (r) => `
          <div style="background:rgba(168,85,247,.1);border:1px solid rgba(168,85,247,.3);border-radius:8px;padding:10px 14px;font-size:13px;cursor:pointer;" onclick="openEmployeeCard(${
            r.id
          })">
            ✈️ <strong>${r.last_name} ${r.first_name}</strong> ← Блок ${
              r.block || '?'
            }, комн. ${r.room || '?'}
          </div>
        `
          )
          .join('')}
      </div>`;
  } else {
    alertSection.style.display = 'none';
  }

  // Block overview
  const blocks = {};
  res.forEach((r) => {
    if (!r.block) return;
    if (!blocks[r.block])
      blocks[r.block] = { total: 0, active: 0, rooms: new Set() };
    blocks[r.block].total++;
    if (r.status === 'active') blocks[r.block].active++;
    if (r.room) blocks[r.block].rooms.add(r.room);
  });

  const bg = document.getElementById('dash-blocks');
  const bkeys = Object.keys(blocks).sort();
  bg.innerHTML = bkeys.length
    ? bkeys
        .map((blk) => {
          const b = blocks[blk];
          const rooms = [...b.rooms].sort();
          const floors = [...new Set(rooms.map((r) => getFloor(r)))]
            .filter((f) => f > 0)
            .sort();
          return `<div class="bcard" onclick="switchToPage('blocks');document.getElementById('block-select').value='${blk}';renderBlockFloors();">
      <div class="bcard-name">Блок ${blk}</div>
      <div class="bcard-floors">${floors
        .map((f) => getFloorName(f))
        .join(' · ')}</div>
      <div class="bcard-stats">
        <div class="bcard-stat"><div class="bcard-stat-val" style="color:var(--green);">${
          b.active
        }</div><div class="bcard-stat-lbl">проживают</div></div>
        <div class="bcard-stat"><div class="bcard-stat-val" style="color:var(--muted);">${
          b.rooms.size
        }</div><div class="bcard-stat-lbl">комнат</div></div>
        <div class="bcard-stat"><div class="bcard-stat-val" style="color:var(--accent);">${
          b.total
        }</div><div class="bcard-stat-lbl">всего</div></div>
      </div>
    </div>`;
        })
        .join('')
    : '<div class="text-muted">Нет данных. Импортируйте файлы.</div>';
}

// ═══════════════════════════════════════════════════════
//  BLOCKS & FLOORS
// ═══════════════════════════════════════════════════════
function populateBlockSelect() {
  const blocks = [
    ...new Set(DB.residents.map((r) => r.block).filter(Boolean)),
  ].sort();
  const sel = document.getElementById('block-select');
  sel.innerHTML =
    '<option value="">Выберите блок</option>' +
    blocks.map((b) => `<option value="${b}">${b}</option>`).join('');
}

function renderBlockFloors() {
  const blk = document.getElementById('block-select').value;
  const container = document.getElementById('block-floors-container');
  if (!blk) {
    container.innerHTML =
      '<div class="empty"><div class="empty-icon">🏢</div><div>Выберите блок для просмотра</div></div>';
    return;
  }

  // Get all rooms in this block
  const roomMap = {};

  // 1. Создаем ВСЕ комнаты из allRooms (включая пустые)
  if (DB.allRooms) {
    DB.allRooms.forEach((r) => {
      if (r.block == blk && r.room) {
        if (!roomMap[r.room])
          roomMap[r.room] = { residents: [], reliefResidents: [] };
      }
    });
  }

  // 2. Добавляем комнаты жильцов (на случай, если их нет в allRooms)
  DB.residents.forEach((r) => {
    if (r.block !== blk || !r.room) return;
    if (!roomMap[r.room])
      roomMap[r.room] = { residents: [], reliefResidents: [] };
  });
  console.log('Комнат в roomMap: ', Object.keys(roomMap).length);
  console.log('Есть ли 227?', roomMap['227']);

  // Fill residents
  DB.residents.forEach((r) => {
    if (r.block !== blk || !r.room || !roomMap[r.room]) return;
    if (r.status === 'active') {
      roomMap[r.room].residents.push(r);
    }
  });

  // Fill reliefs (from assignments)
  DB.assignments.forEach((a) => {
    if (a.block !== blk || !a.room) return;
    if (!roomMap[a.room])
      roomMap[a.room] = { residents: [], reliefResidents: [] };
    const relief = getEmployeeByEmpNumber(a.emp_number_2);
    if (relief && relief.status === 'expected') {
      roomMap[a.room].reliefResidents.push(relief);
    }
  });

  const roomNumbers = Object.keys(roomMap).sort(
    (a, b) => parseInt(a) - parseInt(b)
  );
  const floors = { 1: [], 2: [], 3: [], 0: [] };
  roomNumbers.forEach((rn) => {
    const f = getFloor(rn);
    floors[f].push(rn);
  });

  container.innerHTML =
    [1, 2, 3]
      .map((floor) => {
        if (floors[floor].length === 0) return '';
        const color = getFloorColor(floor);
        return `<div class="floor-section">
      <div class="floor-header">
        <div class="floor-dot" style="background:${color};"></div>
        <div>
          <div class="floor-title" style="color:${color};">${getFloorName(
          floor
        )}</div>
          <div class="floor-subtitle">${
            floors[floor].length
          } комнат · Блок ${blk}</div>
        </div>
      </div>
      <div class="rooms-grid">
        ${floors[floor]
          .map((rn) => {
            const rm = roomMap[rn];
            const totalOcc = rm.residents.length + rm.reliefResidents.length;
            const isFree = totalOcc === 0;
            const isFull = totalOcc >= 4;
            const stateClass = isFree
              ? 'free'
              : isFull
              ? 'occupied'
              : 'partial';
            const badgeText = isFree ? 'СВОБ' : isFull ? 'ЗАН' : 'ЧАСТ';
            const badgeClass = isFree ? 'free-badge' : 'occ-badge';

            return `<div class="room-card ${stateClass}" onclick="openRoomDetail('${blk}','${rn}')">
            <div class="room-badge ${badgeClass}">${badgeText}</div>
            <div class="room-number" style="color:${
              isFree ? 'var(--green)' : isFull ? 'var(--red)' : 'var(--yellow)'
            };">${rn}</div>
            <div class="room-occupants">
              ${rm.residents
                .map(
                  (r) => `
                <div class="room-occupant">
                  <div class="room-occupant-dot primary"></div>
                  <span>${r.first_name} ${r.last_name || ''}</span>
                </div>
              `
                )
                .join('')}
              ${rm.reliefResidents
                .map(
                  (r) => `
                <div class="room-occupant">
                <div class="room-occupant-dot secondary"></div>
                <span style="color:var(--muted);">${r.first_name || ''} ${
                    r.last_name || ''
                  } (смен.)</span>
                </div>
                `
                )
                .join('')}
              ${
                totalOcc === 0
                  ? '<div style="color:var(--muted);font-size:11px;">Свободно</div>'
                  : ''
              }
            </div>
          </div>`;
          })
          .join('')}
      </div>
    </div>`;
      })
      .join('') ||
    '<div class="empty"><div class="empty-icon">📭</div><div>Нет комнат в этом блоке</div></div>';
}

function openRoomDetail(block, room) {
  const residents = DB.residents.filter(
    (r) => r.block === block && r.room === room && r.status === 'active'
  );
  const assignments = DB.assignments.filter(
    (a) => a.block === block && a.room === room
  );

  const reliefs = [];
  assignments.forEach((a) => {
    const emp = getEmployeeByEmpNumber(a.emp_number_2);
    if (emp) reliefs.push(emp);
  });

  const content = document.getElementById('modal-emp-content');
  content.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
      <h2>Комната ${room} · Блок ${block} · ${getFloorName(getFloor(room))}</h2>
      <button class="btn btn-ghost btn-sm" onclick="closeOverlay('modal-emp')">✕</button>
    </div>
    <div class="emp-section">
      <div class="sec-title">Проживающие (${residents.length}/4)</div>
      ${
        residents
          .map(
            (r) => `
        <div class="emp-card" style="margin-bottom:12px;cursor:pointer;" onclick="closeOverlay('modal-emp');openEmployeeCard(${
          r.id
        })">
          <div class="emp-card-header">
            <div><div class="emp-name">${r.last_name} ${
              r.first_name
            }</div><div class="emp-id">Таб. № ${r.emp_number || '—'}</div></div>
            ${getStatusBadge(r.status)}
          </div>
          <div class="emp-grid">
            <div class="emp-field"><div class="emp-field-label">Заезд</div><div class="emp-field-value">${formatDate(
              r.arrive_date
            )}</div></div>
            <div class="emp-field"><div class="emp-field-label">Выезд</div><div class="emp-field-value">${formatDate(
              r.depart_date
            )}</div></div>
          </div>
        </div>
      `
          )
          .join('') || '<div class="text-muted">Нет проживающих</div>'
      }
    </div>
    ${
      reliefs.length > 0
        ? `
    <div class="emp-section">
      <div class="sec-title">Плановые сменщики</div>
      ${reliefs
        .map(
          (r) => `
        <div style="padding:8px;cursor:pointer;" onclick="closeOverlay('modal-emp');openEmployeeCard(${r.id})">
          <span class="fw-bold">${r.last_name} ${r.first_name}</span>
          <span class="text-muted"> · Таб. № ${r.emp_number}</span>
        </div>
      `
        )
        .join('')}
    </div>`
        : ''
    }
  `;
  document.getElementById('modal-emp').classList.add('open');
}

// ═══════════════════════════════════════════════════════
//  EMPLOYEE CARD & FORM
// ═══════════════════════════════════════════════════════
function openEmployeeCard(id) {
  const r = getEmployeeById(id);
  if (!r) return;

  // Find relief
  const assignment = DB.assignments.find(
    (a) => a.emp_number_1 === r.emp_number || a.emp_number_2 === r.emp_number
  );
  let relief = null;
  if (assignment) {
    const reliefEmpNum =
      assignment.emp_number_1 === r.emp_number
        ? assignment.emp_number_2
        : assignment.emp_number_1;
    relief = getEmployeeByEmpNumber(reliefEmpNum);
  }

  const progress = getVacationProgress(r);
  const content = document.getElementById('modal-emp-content');
  content.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
      <h2>Карточка сотрудника</h2>
      <div style="display:flex;gap:8px;">
        <button class="btn btn-ghost btn-sm" onclick="closeOverlay('modal-emp');openEmployeeModal(${
          r.id
        })">✎ Редактировать</button>
        <button class="btn btn-ghost btn-sm" onclick="closeOverlay('modal-emp')">✕</button>
      </div>
    </div>
    <div class="emp-card">
      <div class="emp-card-header">
        <div>
          <div class="emp-name">${r.last_name} ${r.first_name}</div>
          <div class="emp-id">Таб. № ${r.emp_number || '—'} · ${
    r.company || '—'
  }</div>
        </div>
        ${getStatusBadge(r.status)}
      </div>
      <div class="emp-grid">
        <div class="emp-field"><div class="emp-field-label">Блок</div><div class="emp-field-value" style="color:var(--accent);">${
          r.block || '—'
        }</div></div>
        <div class="emp-field"><div class="emp-field-label">Комната</div><div class="emp-field-value">${
          r.room || '—'
        } (${getFloorName(getFloor(r.room))})</div></div>
        <div class="emp-field"><div class="emp-field-label">Дата заезда</div><div class="emp-field-value">${formatDate(
          r.arrive_date
        )}</div></div>
        <div class="emp-field"><div class="emp-field-label">Дата выезда</div><div class="emp-field-value">${formatDate(
          r.depart_date
        )}</div></div>
        <div class="emp-field"><div class="emp-field-label">Вахта</div><div class="emp-field-value">${
          r.shift || '—'
        }</div></div>
        <div class="emp-field"><div class="emp-field-label">Отдел</div><div class="emp-field-value">${
          r.department || '—'
        }</div></div>
      </div>
      ${
        progress
          ? `
      <div class="emp-section">
        <div class="sec-title">Прогресс вахты</div>
        <div style="margin-top:8px;">
          <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:4px;">
            <span>День ${progress.elapsed} из ${progress.total}</span>
            <span style="color:${
              progress.remaining <= 3 ? 'var(--red)' : 'var(--muted)'
            };">${
              progress.remaining > 0
                ? 'Осталось ' + progress.remaining + ' дн.'
                : 'Выезд сегодня!'
            }</span>
          </div>
          <div style="height:6px;background:var(--border);border-radius:3px;overflow:hidden;">
            <div style="width:${progress.pct}%;height:100%;background:${
              progress.color
            };border-radius:3px;"></div>
          </div>
        </div>
      </div>`
          : ''
      }
      ${
        relief
          ? `
      <div class="emp-section">
        <div class="sec-title">Сменщик</div>
        <div style="cursor:pointer;margin-top:8px;" onclick="closeOverlay('modal-emp');openEmployeeCard(${
          relief.id
        })">
          <span class="fw-bold">${relief.last_name} ${relief.first_name}</span>
          <span class="text-muted"> · Таб. № ${relief.emp_number}</span>
          ${getStatusBadge(relief.status)}
        </div>
      </div>`
          : ''
      }
      ${
        r.notes
          ? `<div class="emp-section"><div class="sec-title">Примечание</div><div class="text-muted" style="margin-top:4px;">${r.notes}</div></div>`
          : ''
      }
    </div>
  `;
  document.getElementById('modal-emp').classList.add('open');
}

let editingEmpId = null;
function openEmployeeModal(id) {
  editingEmpId = id;
  const r = id ? getEmployeeById(id) : null;
  document.getElementById('emp-form-title').textContent = id
    ? 'Редактировать сотрудника'
    : 'Новый сотрудник';
  document.getElementById('ef-btn-del').style.display = id ? '' : 'none';
  document.getElementById('ef-first').value = r?.first_name || '';
  document.getElementById('ef-last').value = r?.last_name || '';
  document.getElementById('ef-emp').value = r?.emp_number || '';
  document.getElementById('ef-company').value = r?.company || '';
  document.getElementById('ef-block').value = r?.block || '';
  document.getElementById('ef-room').value = r?.room || '';
  document.getElementById('ef-shift').value = r?.shift || '';
  document.getElementById('ef-arrive').value = r?.arrive_date || '';
  document.getElementById('ef-depart').value = r?.depart_date || '';
  document.getElementById('ef-status').value = r?.status || 'active';
  document.getElementById('ef-notes').value = r?.notes || '';
  document.getElementById('ef-relief').value = r?.relief_emp_number || '';
  document.getElementById('modal-emp-form').classList.add('open');
}

function saveEmployee() {
  const data = {
    first_name: document.getElementById('ef-first').value.trim(),
    last_name: document.getElementById('ef-last').value.trim(),
    emp_number: document.getElementById('ef-emp').value.trim(),
    company: document.getElementById('ef-company').value.trim(),
    block: document.getElementById('ef-block').value.trim(),
    room: document.getElementById('ef-room').value.trim(),
    shift: document.getElementById('ef-shift').value,
    arrive_date: document.getElementById('ef-arrive').value,
    depart_date: document.getElementById('ef-depart').value,
    status: document.getElementById('ef-status').value,
    notes: document.getElementById('ef-notes').value.trim(),
    relief_emp_number: document.getElementById('ef-relief').value.trim(),
  };

  if (editingEmpId) {
    const idx = DB.residents.findIndex((r) => r.id === editingEmpId);
    const oldData = { ...DB.residents[idx] };
    DB.residents[idx] = { ...DB.residents[idx], ...data };
    addHistory(
      'Обновление сотрудника',
      `${oldData.last_name} ${oldData.first_name} → ${data.last_name} ${data.first_name} | Комната: ${oldData.room} → ${data.room}`,
      editingEmpId,
      'resident'
    );
  } else {
    data.id = DB.nextId++;
    DB.residents.push(data);
    addHistory(
      'Добавление сотрудника',
      `${data.last_name} ${data.first_name}, Блок ${data.block}, Комн. ${data.room}`,
      data.id,
      'resident'
    );
  }

  // Auto-create assignment if relief specified
  if (data.relief_emp_number && data.emp_number) {
    const existingAssign = DB.assignments.find(
      (a) =>
        (a.emp_number_1 === data.emp_number &&
          a.emp_number_2 === data.relief_emp_number) ||
        (a.emp_number_1 === data.relief_emp_number &&
          a.emp_number_2 === data.emp_number)
    );
    if (!existingAssign) {
      DB.assignments.push({
        id: Date.now(),
        emp_number_1: data.emp_number,
        emp_number_2: data.relief_emp_number,
        block: data.block,
        room: data.room,
        start_date: data.arrive_date,
        end_date: data.depart_date,
        notes: 'Авто-создано из карточки сотрудника',
      });
      addHistory(
        'Создание закрепления',
        `${data.emp_number} ↔ ${data.relief_emp_number} | Комн. ${data.room}`,
        null,
        'assignment'
      );
    }
  }

  save();
  closeOverlay('modal-emp-form');
  toast('Сохранено ✓');
  renderResidents();
  populateFilters();
  populateBlockSelect();
}

function deleteEmployee() {
  if (!editingEmpId || !confirm('Удалить сотрудника?')) return;
  const r = getEmployeeById(editingEmpId);
  DB.residents = DB.residents.filter((x) => x.id !== editingEmpId);
  addHistory(
    'Удаление сотрудника',
    `${r?.last_name} ${r?.first_name}, Таб. № ${r?.emp_number}`,
    editingEmpId,
    'resident'
  );
  save();
  closeOverlay('modal-emp-form');
  toast('Удалён', 'terr');
  renderResidents();
}

// ═══════════════════════════════════════════════════════
//  RESIDENTS TABLE
// ═══════════════════════════════════════════════════════
function populateFilters() {
  const blocks = [
    ...new Set(DB.residents.map((r) => r.block).filter(Boolean)),
  ].sort();
  const sb = document.getElementById('sb');
  sb.innerHTML =
    '<option value="">Все блоки</option>' +
    blocks.map((b) => `<option value="${b}">${b}</option>`).join('');
}

function renderResidents() {
  const q = document.getElementById('sq')?.value?.toLowerCase() || '';
  const blk = document.getElementById('sb')?.value || '';
  const st = document.getElementById('ss')?.value || '';

  let rows = DB.residents
    .filter((r) => {
      if (st && r.status !== st) return false;
      if (blk && r.block !== blk) return false;
      if (q) {
        const hay =
          `${r.first_name} ${r.last_name} ${r.emp_number} ${r.room}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    })
    .sort((a, b) => (a.last_name || '').localeCompare(b.last_name || ''));

  const tbody = document.getElementById('res-tbody');
  document.getElementById('res-count').textContent = `Найдено: ${rows.length}`;

  tbody.innerHTML = rows.length
    ? rows
        .map((r) => {
          // Find relief
          const assignment = DB.assignments.find(
            (a) =>
              a.emp_number_1 === r.emp_number || a.emp_number_2 === r.emp_number
          );
          let reliefName = '—';
          if (assignment) {
            const reliefNum =
              assignment.emp_number_1 === r.emp_number
                ? assignment.emp_number_2
                : assignment.emp_number_1;
            const relief = getEmployeeByEmpNumber(reliefNum);
            if (relief)
              reliefName = `${relief.last_name} ${
                relief.first_name?.[0] || ''
              }.`;
          }

          const progress = getVacationProgress(r);
          return `<tr onclick="openEmployeeCard(${r.id})">
      <td><span class="fw-bold">${r.last_name || ''}</span> ${
            r.first_name || ''
          }</td>
      <td class="text-muted">${r.emp_number || '—'}</td>
      <td style="color:var(--accent);">${r.block || '—'}</td>
      <td>${r.room || '—'}</td>
      <td>${reliefName}</td>
      <td>${formatDate(r.arrive_date)}</td>
      <td>${formatDate(r.depart_date)} ${
            progress
              ? `<span style="font-size:10px;color:${progress.color};">(${progress.remaining} дн.)</span>`
              : ''
          }</td>
      <td>${getStatusBadge(r.status)}</td>
      <td><button class="btn btn-ghost btn-sm" onclick="event.stopPropagation();openEmployeeModal(${
        r.id
      })">✎</button></td>
    </tr>`;
        })
        .join('')
    : '<tr><td colspan="9" style="text-align:center;color:var(--muted);padding:24px;">Нет сотрудников</td></tr>';
}

// ═══════════════════════════════════════════════════════
//  ASSIGNMENTS
// ═══════════════════════════════════════════════════════
function renderAssignments() {
  const tbody = document.getElementById('assign-tbody');
  tbody.innerHTML = DB.assignments.length
    ? DB.assignments
        .map((a, i) => {
          const emp1 = getEmployeeByEmpNumber(a.emp_number_1);
          const emp2 = getEmployeeByEmpNumber(a.emp_number_2);
          return `<tr>
      <td>${
        emp1
          ? `<span class="fw-bold">${emp1.last_name} ${emp1.first_name}</span>`
          : a.emp_number_1
      }</td>
      <td>${
        emp2
          ? `<span class="fw-bold">${emp2.last_name} ${emp2.first_name}</span>`
          : a.emp_number_2
      }</td>
      <td style="color:var(--accent);">${a.block || '—'}</td>
      <td>${a.room || '—'}</td>
      <td>${formatDate(a.start_date)} → ${formatDate(a.end_date)}</td>
      <td><button class="btn btn-danger btn-sm" onclick="deleteAssignment(${i})">✕</button></td>
    </tr>`;
        })
        .join('')
    : '<tr><td colspan="6" style="text-align:center;color:var(--muted);padding:24px;">Нет закреплений</td></tr>';
}

function openAssignmentModal() {
  document.getElementById('modal-assign').classList.add('open');
}

function saveAssignment() {
  const data = {
    id: Date.now(),
    emp_number_1: document.getElementById('af-emp1').value.trim(),
    emp_number_2: document.getElementById('af-emp2').value.trim(),
    block: document.getElementById('af-block').value.trim(),
    room: document.getElementById('af-room').value.trim(),
    start_date: document.getElementById('af-start').value,
    end_date: document.getElementById('af-end').value,
    notes: document.getElementById('af-notes').value.trim(),
  };
  DB.assignments.push(data);
  addHistory(
    'Новое закрепление',
    `${data.emp_number_1} ↔ ${data.emp_number_2} | Комн. ${data.room}`,
    null,
    'assignment'
  );
  save();
  closeOverlay('modal-assign');
  toast('Закрепление сохранено ✓');
  renderAssignments();
}

function deleteAssignment(i) {
  if (!confirm('Удалить закрепление?')) return;
  const a = DB.assignments[i];
  DB.assignments.splice(i, 1);
  addHistory(
    'Удаление закрепления',
    `${a.emp_number_1} ↔ ${a.emp_number_2}`,
    null,
    'assignment'
  );
  save();
  renderAssignments();
  toast('Удалено', 'terr');
}

// ═══════════════════════════════════════════════════════
//  OVERTIME SEARCH
// ═══════════════════════════════════════════════════════
function populateOvertimeFilters() {
  const blocks = [
    ...new Set(DB.allRooms.map((r) => r.block).filter(Boolean)),
  ].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  document.getElementById('ot-block').innerHTML =
    '<option value="">Все блоки</option>' +
    blocks.map((b) => `<option value="${b}">${b}</option>`).join('');
}

function searchOvertime() {
  const block = document.getElementById('ot-block').value;
  const floor = document.getElementById('ot-floor').value;
  const arrive = document.getElementById('ot-arrive').value;
  const depart = document.getElementById('ot-depart').value;
  const results = document.getElementById('ot-results');

  if (!arrive || !depart) {
    results.innerHTML =
      '<div style="color:var(--red);">Укажите даты заезда и выезда</div>';
    return;
  }

  const arrDate = new Date(arrive);
  arrDate.setHours(0, 0, 0, 0);
  const depDate = new Date(depart);
  depDate.setHours(0, 0, 0, 0);

  // Collect all possible rooms
  // Collect all possible rooms (из allRooms, а не из residents)
  const allRooms = new Map();
  DB.allRooms.forEach((r) => {
    if (!r.block || !r.room) return;
    if (block && r.block !== block) return;
    const rn = parseInt(r.room);
    if (floor && getFloor(r.room) !== parseInt(floor)) return;
    const key = r.block + '||' + r.room;
    if (!allRooms.has(key))
      allRooms.set(key, { block: r.block, room: r.room, conflicts: [] });
  });

  // Check conflicts
  allRooms.forEach((roomData, key) => {
    const residents = DB.residents.filter(
      (r) => r.block + '||' + r.room === key && r.status === 'active'
    );
    residents.forEach((r) => {
      const rArr = r.arrive_date ? new Date(r.arrive_date) : null;
      const rDep = r.depart_date ? new Date(r.depart_date) : null;
      if ((!rDep || rDep >= arrDate) && (!rArr || rArr <= depDate)) {
        roomData.conflicts.push(r);
      }
    });
  });

  const free = [],
    occupied = [];
  allRooms.forEach((data) => {
    if (data.conflicts.length === 0) free.push(data);
    else occupied.push(data);
  });
  free.sort((a, b) => parseInt(a.room) - parseInt(b.room));

  results.innerHTML = `
    <div class="sec-title">Результаты поиска</div>
    <div style="margin-bottom:12px;font-size:13px;">
      <span class="text-muted">Период:</span> ${arrive} → ${depart} (${Math.round(
    (depDate - arrDate) / 86400000
  )} дн.)
      ${block ? ` · Блок ${block}` : ''}
      ${floor ? ` · ${getFloorName(parseInt(floor))}` : ''}
    </div>
    ${
      free.length > 0
        ? `
      <div style="margin-bottom:16px;">
        <div style="color:var(--green);font-weight:600;margin-bottom:10px;">✅ Свободные комнаты: ${
          free.length
        }</div>
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(110px,1fr));gap:8px;">
          ${free
            .map(
              (r) => `
            <div style="background:rgba(62,207,142,.1);border:1px solid rgba(62,207,142,.3);border-radius:8px;padding:10px;text-align:center;">
              <div style="font-size:9px;color:var(--muted);">${r.block}</div>
              <div style="font-size:20px;font-weight:700;color:var(--green);">${r.room}</div>
              <div style="font-size:9px;color:var(--muted);">свободно</div>
            </div>
          `
            )
            .join('')}
        </div>
      </div>
    `
        : '<div style="color:var(--red);font-weight:600;">❌ Свободных комнат нет</div>'
    }
    ${
      occupied.length > 0
        ? `
      <div style="font-size:12px;color:var(--muted);">
        Занятые: ${occupied.map((r) => `${r.block}-${r.room}`).join(', ')}
      </div>
    `
        : ''
    }
  `;
}

// ═══════════════════════════════════════════════════════
//  HISTORY
// ═══════════════════════════════════════════════════════
function renderHistory() {
  const q = document.getElementById('hq')?.value?.toLowerCase() || '';
  let items = DB.history;
  if (q)
    items = items.filter(
      (h) =>
        h.action.toLowerCase().includes(q) || h.detail.toLowerCase().includes(q)
    );

  const container = document.getElementById('history-list');
  container.innerHTML = items.length
    ? items
        .map(
          (h) => `
    <div class="history-item">
      <div class="history-icon">${getHistoryIcon(h.action)}</div>
      <div class="history-content">
        <div class="history-action">${h.action}</div>
        <div class="history-detail">${h.detail}</div>
        <div class="history-time">${formatDate(h.timestamp)} · ${h.user}</div>
      </div>
    </div>
  `
        )
        .join('')
    : '<div class="empty"><div class="empty-icon">📋</div><div>История пуста</div></div>';
}

function getHistoryIcon(action) {
  if (action.includes('Добавление')) return '➕';
  if (action.includes('Удаление')) return '🗑️';
  if (action.includes('Обновление')) return '✏️';
  if (action.includes('Импорт')) return '📥';
  if (action.includes('Закрепление') || action.includes('Создание закрепления'))
    return '🔗';
  return '📌';
}

function exportHistory() {
  const text = DB.history
    .map((h) => `${h.timestamp} | ${h.user} | ${h.action} | ${h.detail}`)
    .join('\n');
  const blob = new Blob([text], { type: 'text/plain' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `history_${new Date().toISOString().slice(0, 10)}.txt`;
  a.click();
  toast('История экспортирована ✓');
}

// ═══════════════════════════════════════════════════════
//  IMPORT ADR
// ═══════════════════════════════════════════════════════
const dzAdr = document.getElementById('dropzone-adr');
if (dzAdr) {
  dzAdr.addEventListener('dragover', (e) => {
    e.preventDefault();
    dzAdr.classList.add('drag');
  });
  dzAdr.addEventListener('dragleave', () => dzAdr.classList.remove('drag'));
  dzAdr.addEventListener('drop', (e) => {
    e.preventDefault();
    dzAdr.classList.remove('drag');
    if (e.dataTransfer.files[0]) processADR(e.dataTransfer.files[0]);
  });
}

function importADR(inp) {
  if (inp.files[0]) processADR(inp.files[0]);
}

function processADR(file) {
  const ir = document.getElementById('ir-adr');
  ir.style.display = 'none';
  const reader = new FileReader();
  reader.onload = function (e) {
    try {
      const wb = XLSX.read(e.target.result, { type: 'array' });
      let sheetName = wb.SheetNames[0];
      for (const n of wb.SheetNames) {
        if (
          n.toUpperCase().includes('AADDR') ||
          n.toUpperCase().includes('СПИСОК')
        ) {
          sheetName = n;
          break;
        }
      }
      const ws = wb.Sheets[sheetName];
      const range = XLSX.utils.decode_range(ws['!ref']);
      if (range.e.c < 120) range.e.c = 120;
      const raw = XLSX.utils.sheet_to_json(ws, {
        header: 1,
        defval: '',
        range: XLSX.utils.encode_range(range),
      });

      let imported = 0,
        updated = 0;
      let currentColMap = null;

      // Функция: является ли строка заголовком?
      function isHeaderRow(row) {
        const rowLower = row.map((c) => String(c).toLowerCase());
        const hasName = rowLower.some(
          (c) => c === 'name' || c.includes('first name') || c.includes('имя')
        );
        const hasSurname = rowLower.some(
          (c) =>
            c.includes('surname') ||
            c.includes('last name') ||
            c.includes('фамилия')
        );
        const hasRoom = rowLower.some(
          (c) => c.includes('room') || c.includes('комн')
        );
        const hasShiftA = rowLower.some((c) => c.includes('shifta_first'));
        // Считаем строку заголовком, если есть имя+фамилия+комната ИЛИ есть колонка ShiftA_First
        return (hasName && hasSurname && hasRoom) || hasShiftA;
      }
      // Функция: строим карту колонок
      function buildColMap(headerRow) {
        let colMap = {};
        headerRow.forEach((h, j) => {
          const hLower = String(h).toLowerCase();

          // Пропускаем совмещенные колонки типа "First name Last name"
          const isCombined =
            (hLower.includes('first') && hLower.includes('last')) ||
            (hLower.includes('имя') &&
              (hLower.includes('фам') || hLower.includes('surname')));
          if (isCombined) return;

          if (
            !colMap.first_name &&
            (hLower === 'name' ||
              hLower.includes('first') ||
              hLower.includes('имя'))
          )
            colMap.first_name = j;
          else if (
            !colMap.last_name &&
            (hLower.includes('surname') ||
              hLower.includes('last') ||
              hLower.includes('фам'))
          )
            colMap.last_name = j;
          else if (
            !colMap.emp_number &&
            (hLower.includes('emp') || hLower.includes('таб'))
          )
            colMap.emp_number = j;
          else if (!colMap.company && hLower.includes('comp'))
            colMap.company = j;
          else if (
            !colMap.block &&
            (hLower.includes('block') || hLower.includes('блок'))
          )
            colMap.block = j;
          else if (
            !colMap.room &&
            (hLower.includes('room') || hLower.includes('комн'))
          )
            colMap.room = j;
          else if (
            !colMap.department &&
            (hLower.includes('dep') || hLower.includes('отдел'))
          )
            colMap.department = j;
          else if (!colMap.shiftA_first && hLower.includes('shifta_first'))
            colMap.shiftA_first = j;
          else if (!colMap.shiftA_last && hLower.includes('shifta_last'))
            colMap.shiftA_last = j;
          else if (!colMap.shiftB_first && hLower.includes('shiftb_first'))
            colMap.shiftB_first = j;
          else if (!colMap.shiftB_last && hLower.includes('shiftb_last'))
            colMap.shiftB_last = j;
          else if (
            !colMap.shift &&
            (hLower.includes('shift') || hLower.includes('вахт'))
          )
            colMap.shift = j;
        });
        return colMap;
      }

      // Проходим по всем строкам листа
      raw.forEach((row, rowIndex) => {
        if (isHeaderRow(row)) {
          currentColMap = buildColMap(row);
          console.log('=== ЗАГОЛОВОК, индекс', rowIndex, '===');
          console.log(
            'Заголовки:',
            row.map((h, i) => i + ': "' + h + '"').join('|')
          );
          console.log('ColMap:', currentColMap);
          return;
        }
        if (!currentColMap) return;
        if (rowIndex < 20) console.log('--- Строка данных', rowIndex, ':', row);

        const g = (k) =>
          currentColMap[k] != null && currentColMap[k] < row.length
            ? String(row[currentColMap[k]]).trim()
            : '';
        const first = g('first_name');
        const last = g('last_name');
        const emp = g('emp_number');
        const blockVal = g('block');
        const roomVal = g('room');

        if (blockVal && roomVal) {
          const roomExists = DB.allRooms.find(
            (r) => r.block == blockVal && r.room == roomVal
          );
          if (!roomExists) {
            DB.allRooms.push({ block: blockVal, room: roomVal });
          }
        }

        if (!first && !last && !emp) return;

        const rec = {
          first_name: first,
          last_name: last,
          emp_number: emp,
          company: g('company'),
          block: blockVal,
          room: roomVal,
          shift: g('shift'),
          status: 'active',
          shiftA_first: g('shiftA_first'),
          shiftA_last: g('shiftA_last'),
          shiftB_first: g('shiftB_first'),
          shiftB_last: g('shiftB_last'),
        };

        const existing = emp
          ? DB.residents.find((r) => r.emp_number == emp)
          : null;
        if (existing) {
          Object.assign(existing, rec);
          updated++;
        } else {
          rec.id = DB.nextId++;
          DB.residents.push(rec);
          imported++;
        }
      });
      // ─── Читаем лист "Проверка закреплений" ───
      const zakrSheetName = wb.SheetNames.find(
        (n) =>
          n.toLowerCase().includes('проверка') ||
          n.toLowerCase().includes('закреплен')
      );

      if (zakrSheetName) {
        console.log('=== ЧИТАЕМ ЛИСТ ЗАКРЕПЛЕНИЙ:', zakrSheetName, '===');
        const wsZ = wb.Sheets[zakrSheetName];
        const rawZ = XLSX.utils.sheet_to_json(wsZ, { header: 1, defval: '' });

        const roomShifts = {};
        for (let i = 1; i < rawZ.length; i++) {
          const row = rawZ[i] || [];
          const shiftFirst = String(row[1] || '').trim();
          const shiftLast = String(row[2] || '').trim();
          const shiftBlock = String(row[4] || '').trim();
          const shiftRoom = String(row[5] || '').trim();

          if (!shiftFirst && !shiftLast) continue;
          if (!shiftBlock || !shiftRoom) continue;

          const key = shiftBlock + '||' + shiftRoom;
          if (!roomShifts[key]) roomShifts[key] = [];
          roomShifts[key].push({
            first_name: shiftFirst,
            last_name: shiftLast,
          });
        }

        let shiftsUpdated = 0;
        DB.residents.forEach((r) => {
          if (!r.block || !r.room) return;
          const key = r.block + '||' + r.room;
          const shifts = roomShifts[key];
          if (shifts && shifts.length > 0) {
            if (shifts[0]) {
              r.shiftA_first = shifts[0].first_name;
              r.shiftA_last = shifts[0].last_name;
            }
            if (shifts[1]) {
              r.shiftB_first = shifts[1].first_name;
              r.shiftB_last = shifts[1].last_name;
            }
            shiftsUpdated++;
          }
        });

        console.log('Жильцов со сменщиками:', shiftsUpdated);
      }
      // ─── КОНЕЦ БЛОКА ───

      addHistory(
        'Импорт ADR',
        `Файл: ${file.name} | Лист: ${sheetName} | +${imported} новых, ~${updated} обновлено`
      );
      save();
      ir.className = 'import-result ir-ok';
      ir.innerHTML = `✅ Готово!<br>Лист: <strong>${sheetName}</strong><br>Добавлено: <strong>${imported}</strong> · Обновлено: <strong>${updated}</strong>`;
      ir.style.display = '';
      toast(`ADR: +${imported}, ~${updated} обновлено`);
      populateFilters();
      populateBlockSelect();
    } catch (err) {
      ir.className = 'import-result ir-err';
      ir.innerHTML = '❌ Ошибка: ' + err.message;
      ir.style.display = '';
    }
  };
  reader.readAsArrayBuffer(file);
}

// ═══════════════════════════════════════════════════════
//  IMPORT ENCLOSEMENT
// ═══════════════════════════════════════════════════════
const dzEncl = document.getElementById('dropzone-encl');
if (dzEncl) {
  dzEncl.addEventListener('dragover', (e) => {
    e.preventDefault();
    dzEncl.classList.add('drag');
  });
  dzEncl.addEventListener('dragleave', () => dzEncl.classList.remove('drag'));
  dzEncl.addEventListener('drop', (e) => {
    e.preventDefault();
    dzEncl.classList.remove('drag');
    if (e.dataTransfer.files[0]) processEnclosement(e.dataTransfer.files[0]);
  });
}

function importEnclosement(inp) {
  if (inp.files[0]) processEnclosement(inp.files[0]);
}

function processEnclosement(file) {
  const ir = document.getElementById('ir-encl');
  ir.style.display = 'none';
  const reader = new FileReader();
  reader.onload = function (e) {
    try {
      const wb = XLSX.read(e.target.result, { type: 'array' });
      const sheetName = wb.SheetNames[0];
      console.log('== ЧИТАЕМ ЛИСТ:', sheetName, '===');
      console.log('Все листы в файле:', wb.SheetNaes);
      const ws = wb.Sheets[sheetName];
      const raw = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

      let colMap = {},
        headerRow = -1;
      for (let i = 0; i < Math.min(15, raw.length); i++) {
        const row = raw[i].map((c) => String(c).toLowerCase());
        const hits = row.filter((c) =>
          [
            'arrive',
            'depart',
            'room',
            'name',
            'фам',
            'имя',
            'заезд',
            'выезд',
            'комн',
          ].some((k) => c.includes(k))
        ).length;
        if (hits >= 2) {
          headerRow = i;
          row.forEach((h, j) => {
            if (h.includes('first') || h.includes('имя')) colMap.first_name = j;
            else if (h.includes('last') || h.includes('фам'))
              colMap.last_name = j;
            else if (h.includes('emp') || h.includes('таб'))
              colMap.emp_number = j;
            else if (
              h.includes('arrive') ||
              h.includes('заезд') ||
              h.includes('arrival')
            )
              colMap.arrive_date = j;
            else if (
              h.includes('depart') ||
              h.includes('выезд') ||
              h.includes('departure')
            )
              colMap.depart_date = j;
            else if (h.includes('block') || h.includes('блок'))
              colMap.block = j;
            else if (h.includes('room') || h.includes('комн')) colMap.room = j;
            else if (
              h.includes('relief') ||
              h.includes('сменщик') ||
              h.includes('rel')
            )
              colMap.relief_emp = j;
            else if (h.includes('comp')) colMap.company = j;
            else if (h.includes('shift') || h.includes('вахт'))
              colMap.shift = j;
          });
          break;
        }
      }

      const dataRows = raw.slice(headerRow + 1);
      let imported = 0,
        updated = 0,
        assignmentsCreated = 0;
      dataRows.forEach((row) => {
        const g = (k) =>
          colMap[k] != null && colMap[k] < row.length
            ? String(row[colMap[k]]).trim()
            : '';
        const first = g('first_name'),
          last = g('last_name'),
          emp = g('emp_number');
        if (!first && !last && !emp) return;

        const rec = {
          first_name: first,
          last_name: last,
          emp_number: emp,
          company: g('company'),
          block: g('block'),
          room: g('room'),
          shift: g('shift'),
          arrive_date: g('arrive_date'),
          depart_date: g('depart_date'),
          status: 'expected',
          relief_emp_number: g('relief_emp'),
        };

        const existing = emp
          ? DB.residents.find((r) => r.emp_number === emp)
          : null;
        if (existing) {
          Object.assign(existing, rec);
          updated++;
        } else {
          rec.id = DB.nextId++;
          DB.residents.push(rec);
          imported++;
        }

        // Create assignment if relief specified
        if (rec.relief_emp_number && rec.emp_number && rec.room) {
          const alreadyAssigned = DB.assignments.find(
            (a) =>
              (a.emp_number_1 === rec.emp_number &&
                a.emp_number_2 === rec.relief_emp_number) ||
              (a.emp_number_1 === rec.relief_emp_number &&
                a.emp_number_2 === rec.emp_number)
          );
          if (!alreadyAssigned) {
            DB.assignments.push({
              id: Date.now() + Math.random(),
              emp_number_1: rec.emp_number,
              emp_number_2: rec.relief_emp_number,
              block: rec.block,
              room: rec.room,
              start_date: rec.arrive_date,
              end_date: rec.depart_date,
              notes: 'Из Enclosement',
            });
            assignmentsCreated++;
          }
        }
      });

      addHistory(
        'Импорт Enclosement',
        `Файл: ${file.name} | +${imported} новых, ~${updated} обновлено, ${assignmentsCreated} закреплений`
      );
      save();
      ir.className = 'import-result ir-ok';
      ir.innerHTML = `✅ Готово!<br>Лист: <strong>${sheetName}</strong><br>Добавлено: <strong>${imported}</strong> · Обновлено: <strong>${updated}</strong><br>Создано закреплений: <strong>${assignmentsCreated}</strong>`;
      ir.style.display = '';
      toast(`Enclosement: +${imported}, ~${updated}, 🔗${assignmentsCreated}`);
      populateFilters();
      populateBlockSelect();
      renderAssignments();
    } catch (err) {
      ir.className = 'import-result ir-err';
      ir.innerHTML = '❌ Ошибка: ' + err.message;
      ir.style.display = '';
    }
  };
  reader.readAsArrayBuffer(file);
}

// ═══════════════════════════════════════════════════════
//  UTILS
// ═══════════════════════════════════════════════════════
function closeOverlay(id) {
  document.getElementById(id).classList.remove('open');
}
document.querySelectorAll('.overlay').forEach((el) =>
  el.addEventListener('click', (e) => {
    if (e.target === el) el.classList.remove('open');
  })
);

// INIT
renderDashboard();
