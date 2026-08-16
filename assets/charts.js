(function () {
  'use strict';

  // === Category Options ===
  var CATEGORY2_OPTIONS = {
    '股票': ['美股', 'A股', '港股', '全球', '其他'],
    '债券': ['中长债', '短债', '可转债', '其他'],
    '黄金': ['黄金ETF', '白银', '其他商品'],
    '现金': ['货币基金', '银行理财', '活期存款', '其他']
  };

  var CATEGORY_TAG_CLASS = {
    '股票': 'tag-stock',
    '债券': 'tag-bond',
    '黄金': 'tag-gold',
    '现金': 'tag-cash'
  };

  // === Data Store ===
  var STORE_KEY = 'portfolio_dashboard_data';

  function getDefaultData() {
    return {
      holdings: [],
      valuation: { pe: null, pb: null, ps: null, vix: null },
      trendData: [],
      settings: { startDate: null, initialCapital: null, maxDrawdown: null }
    };
  }

  var data = loadData();
  var cloudValuation = null; // 云端 data/valuation.json 的内容

  function loadData() {
    try {
      var raw = localStorage.getItem(STORE_KEY);
      if (raw) {
        var parsed = JSON.parse(raw);
        var def = getDefaultData();
        return {
          holdings: parsed.holdings || [],
          valuation: Object.assign(def.valuation, parsed.valuation || {}),
          trendData: parsed.trendData || [],
          settings: Object.assign(def.settings, parsed.settings || {})
        };
      }
    } catch (e) {
      console.error('Failed to load data:', e);
    }
    return getDefaultData();
  }

  function saveData() {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(data));
    } catch (e) {
      console.error('Failed to save data:', e);
      showToast('数据保存失败');
    }
  }

  // === Toast ===
  var toastTimer = null;
  function showToast(msg) {
    var toast = document.getElementById('toast');
    toast.textContent = msg;
    toast.classList.add('active');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toast.classList.remove('active'); }, 2500);
  }

  // === Modal ===
  window.openModal = function (id) {
    document.getElementById(id).classList.add('active');
  };
  window.closeModal = function (id) {
    document.getElementById(id).classList.remove('active');
  };

  // === Category2 Options ===
  window.updateCategory2Options = function () {
    var cat1 = document.getElementById('fCategory1').value;
    var cat2Select = document.getElementById('fCategory2');
    cat2Select.innerHTML = '';
    var options = CATEGORY2_OPTIONS[cat1] || [];
    options.forEach(function (opt) {
      var el = document.createElement('option');
      el.value = opt;
      el.textContent = opt;
      cat2Select.appendChild(el);
    });
  };

  // === Holdings CRUD ===
  window.openAddModal = function () {
    document.getElementById('modalTitle').textContent = '添加持仓';
    document.getElementById('editId').value = '';
    document.getElementById('fCategory1').value = '股票';
    updateCategory2Options();
    document.getElementById('fName').value = '';
    document.getElementById('fAmount').value = '';
    document.getElementById('fProfit').value = '';
    document.getElementById('fChange').value = '';
    document.getElementById('fAction').value = '无';
    openModal('holdingModal');
  };

  window.editHolding = function (id) {
    var h = data.holdings.find(function (x) { return x.id === id; });
    if (!h) return;
    document.getElementById('modalTitle').textContent = '编辑持仓';
    document.getElementById('editId').value = h.id;
    document.getElementById('fCategory1').value = h.category1;
    updateCategory2Options();
    document.getElementById('fCategory2').value = h.category2;
    document.getElementById('fName').value = h.name;
    document.getElementById('fAmount').value = h.amount;
    document.getElementById('fProfit').value = h.todayProfit;
    document.getElementById('fChange').value = h.todayChange;
    document.getElementById('fAction').value = h.todayAction || '无';
    openModal('holdingModal');
  };

  window.deleteHolding = function (id) {
    if (!confirm('确认删除此条持仓记录？')) return;
    data.holdings = data.holdings.filter(function (x) { return x.id !== id; });
    saveData();
    renderAll();
    showToast('已删除');
  };

  window.saveHolding = function () {
    var editId = document.getElementById('editId').value;
    var category1 = document.getElementById('fCategory1').value;
    var category2 = document.getElementById('fCategory2').value;
    var name = document.getElementById('fName').value.trim();
    var amount = parseFloat(document.getElementById('fAmount').value) || 0;
    var profit = parseFloat(document.getElementById('fProfit').value) || 0;
    var change = parseFloat(document.getElementById('fChange').value) || 0;
    var action = document.getElementById('fAction').value;

    if (!name) {
      showToast('请输入名称');
      return;
    }

    if (editId) {
      var h = data.holdings.find(function (x) { return x.id == editId; });
      if (h) {
        h.category1 = category1;
        h.category2 = category2;
        h.name = name;
        h.amount = amount;
        h.todayProfit = profit;
        h.todayChange = change;
        h.todayAction = action;
      }
      showToast('已更新');
    } else {
      data.holdings.push({
        id: Date.now(),
        category1: category1,
        category2: category2,
        name: name,
        amount: amount,
        todayProfit: profit,
        todayChange: change,
        todayAction: action
      });
      showToast('已添加');
    }

    saveData();
    closeModal('holdingModal');
    renderAll();
  };

  // === Render Holdings Table ===
  function renderHoldingsTable() {
    var tbody = document.getElementById('holdingsBody');
    tbody.innerHTML = '';

    if (data.holdings.length === 0) {
      var tr = document.createElement('tr');
      tr.innerHTML = '<td colspan="8"><div class="empty-state"><p>暂无持仓记录，点击「添加持仓」开始记录</p></div></td>';
      tbody.appendChild(tr);
    } else {
      data.holdings.forEach(function (h) {
        var tr = document.createElement('tr');
        var tagClass = CATEGORY_TAG_CLASS[h.category1] || 'tag-stock';
        var profitClass = h.todayProfit > 0 ? 'gain' : (h.todayProfit < 0 ? 'loss' : 'neutral');
        var changeClass = h.todayChange > 0 ? 'gain' : (h.todayChange < 0 ? 'loss' : 'neutral');
        var profitStr = h.todayProfit > 0 ? '+' : '';
        var changeStr = h.todayChange > 0 ? '+' : '';

        tr.innerHTML =
          '<td><span class="category-tag ' + tagClass + '">' + esc(h.category1) + '</span></td>' +
          '<td>' + esc(h.category2) + '</td>' +
          '<td style="font-weight:500">' + esc(h.name) + '</td>' +
          '<td class="td-amount">' + formatMoney(h.amount) + '</td>' +
          '<td class="td-profit ' + profitClass + '">' + profitStr + formatMoney(h.todayProfit) + '</td>' +
          '<td class="td-change ' + changeClass + '">' + changeStr + h.todayChange.toFixed(2) + '%</td>' +
          '<td>' + esc(h.todayAction || '无') + '</td>' +
          '<td><div class="action-cell">' +
          '<button class="btn btn-edit" onclick="editHolding(' + h.id + ')">编辑</button>' +
          '<button class="btn btn-danger" onclick="deleteHolding(' + h.id + ')">删除</button>' +
          '</div></td>';
        tbody.appendChild(tr);
      });
    }

    var totalAmount = data.holdings.reduce(function (s, h) { return s + h.amount; }, 0);
    var totalProfit = data.holdings.reduce(function (s, h) { return s + h.todayProfit; }, 0);
    var totalChangePct = totalAmount > 0 ? (totalProfit / (totalAmount - totalProfit)) * 100 : 0;

    document.getElementById('totalAmount').textContent = '¥' + totalAmount.toFixed(2);
    var profitClass = totalProfit > 0 ? 'gain' : (totalProfit < 0 ? 'loss' : 'neutral');
    document.getElementById('totalProfit').className = 'td-profit ' + profitClass;
    document.getElementById('totalProfit').textContent = (totalProfit > 0 ? '+' : '') + '¥' + totalProfit.toFixed(2);
    var changeClass = totalChangePct > 0 ? 'gain' : (totalChangePct < 0 ? 'loss' : 'neutral');
    document.getElementById('totalChangePct').className = 'td-change ' + changeClass;
    document.getElementById('totalChangePct').textContent = (totalChangePct > 0 ? '+' : '') + totalChangePct.toFixed(2) + '%';

    document.getElementById('totalAssets').textContent = '¥' + totalAmount.toFixed(2);
    var headerChange = document.getElementById('totalChange');
    if (totalProfit !== 0) {
      headerChange.innerHTML = '<span style="color:' + (totalProfit > 0 ? '#6ee7b7' : '#fca5a5') + '">' +
        (totalProfit > 0 ? '+' : '') + '¥' + totalProfit.toFixed(2) +
        ' (' + (totalChangePct > 0 ? '+' : '') + totalChangePct.toFixed(2) + '%)</span>';
    } else {
      headerChange.innerHTML = '<span style="opacity:0.7">暂无收益数据</span>';
    }
  }

  // === Render Summary Cards ===
  function renderSummary() {
    var totalAmount = data.holdings.reduce(function (s, h) { return s + h.amount; }, 0);
    var totalProfit = data.holdings.reduce(function (s, h) { return s + h.todayProfit; }, 0);

    document.getElementById('todayReturn').textContent = (totalProfit > 0 ? '+' : '') + '¥' + totalProfit.toFixed(2);
    var todayPct = totalAmount > 0 ? (totalProfit / (totalAmount - totalProfit)) * 100 : 0;
    var todayPctEl = document.getElementById('todayReturnPct');
    if (totalProfit !== 0) {
      todayPctEl.innerHTML = '<span class="' + (totalProfit > 0 ? 'gain' : 'loss') + '">' +
        (todayPct > 0 ? '+' : '') + todayPct.toFixed(2) + '%</span> 今日';
    } else {
      todayPctEl.textContent = '暂无数据';
    }

    var initial = data.settings.initialCapital;
    var cumReturnEl = document.getElementById('cumulativeReturn');
    var cumReturnPctEl = document.getElementById('cumulativeReturnPct');
    if (initial && initial > 0) {
      var cumReturn = totalAmount - initial;
      var cumPct = (cumReturn / initial) * 100;
      cumReturnEl.textContent = (cumReturn >= 0 ? '+' : '') + '¥' + cumReturn.toFixed(2);
      cumReturnEl.className = 'stat-value ' + (cumReturn >= 0 ? 'gain' : 'loss');
      cumReturnPctEl.innerHTML = '<span class="' + (cumReturn >= 0 ? 'gain' : 'loss') + '">' +
        (cumPct >= 0 ? '+' : '') + cumPct.toFixed(2) + '%</span> 累计';
    } else {
      cumReturnEl.textContent = '¥0.00';
      cumReturnPctEl.innerHTML = '<a href="#" onclick="openSettingsModal();return false;" style="color:var(--accent)">设置初始资金</a>';
    }

    var ddEl = document.getElementById('maxDrawdown');
    var ddSubEl = document.getElementById('maxDrawdownSub');
    if (data.settings.maxDrawdown != null) {
      ddEl.textContent = data.settings.maxDrawdown.toFixed(2) + '%';
      ddEl.className = 'stat-value ' + (data.settings.maxDrawdown < 0 ? 'loss' : 'gain');
      ddSubEl.textContent = '历史最大回撤';
    } else {
      ddEl.textContent = '--';
      ddSubEl.innerHTML = '<a href="#" onclick="openSettingsModal();return false;" style="color:var(--accent)">设置</a>';
    }

    var daysEl = document.getElementById('holdingDays');
    var daysSubEl = document.getElementById('holdingDaysSub');
    if (data.settings.startDate) {
      var start = new Date(data.settings.startDate);
      var today = new Date();
      var days = Math.floor((today - start) / (1000 * 60 * 60 * 24));
      daysEl.textContent = days + '天';
      daysSubEl.textContent = '起始于 ' + data.settings.startDate;
    } else {
      daysEl.textContent = '0';
      daysSubEl.innerHTML = '<a href="#" onclick="openSettingsModal();return false;" style="color:var(--accent)">设置起始日</a>';
    }
  }

  // === Settings Modal (dynamic) ===
  window.openSettingsModal = function () {
    var startDate = data.settings.startDate || '';
    var initial = data.settings.initialCapital || '';
    var maxDD = data.settings.maxDrawdown != null ? data.settings.maxDrawdown : '';

    var html = '<div class="modal" style="display:block">' +
      '<h3>基础设置</h3>' +
      '<div class="form-group"><label>起始日期</label><input type="date" id="setStartDate" value="' + startDate + '"></div>' +
      '<div class="form-group"><label>初始资金(¥)</label><input type="number" id="setInitial" step="0.01" value="' + initial + '" placeholder="如：500000"></div>' +
      '<div class="form-group"><label>最大回撤(%)</label><input type="number" id="setMaxDD" step="0.01" value="' + maxDD + '" placeholder="如：-5.76"></div>' +
      '<div class="modal-actions">' +
      '<button class="btn btn-secondary" onclick="this.closest(\'.modal-overlay\').remove()">取消</button>' +
      '<button class="btn btn-primary" onclick="saveSettings()">保存</button>' +
      '</div></div>';

    var overlay = document.createElement('div');
    overlay.className = 'modal-overlay active';
    overlay.innerHTML = html;
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) overlay.remove();
    });
    document.body.appendChild(overlay);
  };

  window.saveSettings = function () {
    data.settings.startDate = document.getElementById('setStartDate').value || null;
    data.settings.initialCapital = parseFloat(document.getElementById('setInitial').value) || null;
    data.settings.maxDrawdown = parseFloat(document.getElementById('setMaxDD').value);
    if (isNaN(data.settings.maxDrawdown)) data.settings.maxDrawdown = null;
    saveData();
    var overlays = document.querySelectorAll('.modal-overlay');
    if (overlays.length > 0) overlays[overlays.length - 1].remove();
    renderAll();
    showToast('设置已保存');
  };

  // ============================================================
  // Valuation: cloud-first (data/valuation.json), manual fallback
  // ============================================================

  function fetchCloudValuation() {
    return fetch('./data/valuation.json', { cache: 'no-store' })
      .then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      });
  }

  window.refreshCloudValuation = function () {
    fetchCloudValuation()
      .then(function (j) {
        cloudValuation = j;
        renderValuation();
        showToast('云端估值已刷新');
      })
      .catch(function () {
        showToast('云端数据不可用（本地打开时属正常）');
      });
  }

  function renderValuationMeta() {
    var el = document.getElementById('valuationMeta');
    if (cloudValuation && cloudValuation.updated_at) {
      el.className = 'valuation-meta show';
      el.innerHTML = '云端自动更新于 ' + esc(cloudValuation.updated_at) +
        (cloudValuation.source_note ? '<br>数据来源：' + esc(cloudValuation.source_note) : '') +
        '<br>本页仅展示指数公开估值数据，不包含任何个人持仓信息';
    } else {
      el.className = 'valuation-meta show manual-mode';
      el.innerHTML = '当前为手动模式（云端估值数据未加载）。部署到 GitHub Pages 后将每日自动更新；本地直接打开文件时为正常现象。';
    }
  }

  // 返回单个指标的显示对象 {display, percentile, value, asOf, mode}
  function resolveIndicator(key) {
    // 1) 云端数据优先
    if (cloudValuation && cloudValuation.indicators) {
      var ci = cloudValuation.indicators[key];
      if (ci && ci.ok && ci.value != null) {
        return {
          value: ci.value,
          percentile: ci.percentile != null ? ci.percentile : null,
          asOf: ci.as_of || null,
          note: ci.note || null,
          mode: 'cloud'
        };
      }
      if (ci && ci.note) {
        return { value: null, percentile: null, asOf: null, note: ci.note, mode: 'cloud' };
      }
    }
    // 2) 手动数据
    var v = data.valuation[key];
    if (v != null && !isNaN(v)) {
      // 手动输入：pe/pb/ps 是分位数，vix 是原始值
      return {
        value: v,
        percentile: key === 'vix' ? null : v,
        asOf: null,
        mode: 'manual'
      };
    }
    return null;
  }

  function renderValuation() {
    var items = [
      { key: 'pe', valId: 'gaugePE', statusId: 'gaugePEStatus', dateId: 'gaugePEDate', name: 'PE' },
      { key: 'pb', valId: 'gaugePB', statusId: 'gaugePBStatus', dateId: 'gaugePBDate', name: 'PB' },
      { key: 'ps', valId: 'gaugePS', statusId: 'gaugePSStatus', dateId: 'gaugePSDate', name: 'PS' },
      { key: 'vix', valId: 'gaugeVIX', statusId: 'gaugeVIXStatus', dateId: 'gaugeVIXDate', name: 'VIX' }
    ];

    items.forEach(function (item) {
      var valEl = document.getElementById(item.valId);
      var statusEl = document.getElementById(item.statusId);
      var dateEl = document.getElementById(item.dateId);
      var ind = resolveIndicator(item.key);

      if (!ind) {
        valEl.textContent = '--';
        statusEl.textContent = '未设置';
        statusEl.className = 'gauge-status';
        dateEl.textContent = '';
        return;
      }

      if (ind.percentile != null) {
        // 分位数模式
        valEl.textContent = ind.percentile.toFixed(0) + '%';
        setGaugeStatusByPercentile(statusEl, ind.percentile, item.key);
      } else if (ind.value != null) {
        // 原始值模式（无分位数据时）
        valEl.textContent = ind.value.toFixed(2);
        setGaugeStatusByValue(statusEl, ind.value, item.key);
      } else {
        valEl.textContent = '--';
        statusEl.textContent = '暂无数据';
        statusEl.className = 'gauge-status';
      }

      var dateParts = [];
      if (ind.asOf) dateParts.push('数据日期 ' + ind.asOf);
      if (ind.note) dateParts.push(ind.note);
      if (ind.mode === 'manual') dateParts.push('手动');
      dateEl.textContent = dateParts.join(' · ');
    });

    renderValuationMeta();
  }

  function setGaugeStatusByPercentile(el, val, key) {
    if (key === 'vix') {
      // VIX 分位：低分位=市场平静
      if (val <= 20) {
        el.textContent = '历史低位';
        el.className = 'gauge-status status-low';
      } else if (val <= 80) {
        el.textContent = '正常区间';
        el.className = 'gauge-status status-fair';
      } else {
        el.textContent = '历史高位';
        el.className = 'gauge-status status-overvalued';
      }
      return;
    }
    if (val <= 30) {
      el.textContent = '低估';
      el.className = 'gauge-status status-undervalued';
    } else if (val <= 70) {
      el.textContent = '合理';
      el.className = 'gauge-status status-fair';
    } else {
      el.textContent = '高估';
      el.className = 'gauge-status status-overvalued';
    }
  }

  // 原始值模式的状态阈值（参考纳指100历史区间）
  var RAW_THRESHOLDS = {
    pe: [20, 30],   // PE: <20 低估, 20-30 合理, >30 高估
    pb: [5, 8],     // PB: <5 低估, 5-8 合理, >8 高估
    ps: [3, 5],     // PS: <3 低估, 3-5 合理, >5 高估
    vix: [15, 25]   // VIX: <15 低风险, 15-25 正常, >25 偏高
  };

  function setGaugeStatusByValue(el, val, key) {
    var t = RAW_THRESHOLDS[key] || [25, 50];
    if (key === 'vix') {
      if (val < t[0]) {
        el.textContent = '偏低风险';
        el.className = 'gauge-status status-low';
      } else if (val < t[1]) {
        el.textContent = '正常';
        el.className = 'gauge-status status-fair';
      } else if (val < 35) {
        el.textContent = '偏高';
        el.className = 'gauge-status status-overvalued';
      } else {
        el.textContent = '恐慌';
        el.className = 'gauge-status status-overvalued';
      }
      return;
    }
    if (val <= t[0]) {
      el.textContent = '低估';
      el.className = 'gauge-status status-undervalued';
    } else if (val <= t[1]) {
      el.textContent = '合理';
      el.className = 'gauge-status status-fair';
    } else {
      el.textContent = '高估';
      el.className = 'gauge-status status-overvalued';
    }
  }

  // === Manual Valuation Editor ===
  window.openValuationModal = function () {
    document.getElementById('vPE').value = data.valuation.pe != null ? data.valuation.pe : '';
    document.getElementById('vPB').value = data.valuation.pb != null ? data.valuation.pb : '';
    document.getElementById('vPS').value = data.valuation.ps != null ? data.valuation.ps : '';
    document.getElementById('vVIX').value = data.valuation.vix != null ? data.valuation.vix : '';
    openModal('valuationModal');
  };

  window.saveValuation = function () {
    data.valuation.pe = parseFloat(document.getElementById('vPE').value);
    data.valuation.pb = parseFloat(document.getElementById('vPB').value);
    data.valuation.ps = parseFloat(document.getElementById('vPS').value);
    data.valuation.vix = parseFloat(document.getElementById('vVIX').value);
    ['pe', 'pb', 'ps', 'vix'].forEach(function (k) {
      if (isNaN(data.valuation[k])) data.valuation[k] = null;
    });
    saveData();
    closeModal('valuationModal');
    renderValuation();
    showToast('手动估值已保存');
  };

  // === Charts ===
  var chartDaily = null, chartAlloc = null, chartTrend = null;

  function renderCharts() {
    var style = getComputedStyle(document.documentElement);
    var accent = style.getPropertyValue('--accent').trim() || '#3b82f6';
    var accent2 = style.getPropertyValue('--accent2').trim() || '#8b5cf6';
    var gain = style.getPropertyValue('--gain').trim() || '#10b981';
    var loss = style.getPropertyValue('--loss').trim() || '#ef4444';
    var warn = style.getPropertyValue('--warn').trim() || '#f59e0b';
    var ink = style.getPropertyValue('--ink').trim() || '#1f2937';
    var muted = style.getPropertyValue('--muted').trim() || '#6b7280';
    var rule = style.getPropertyValue('--rule').trim() || '#e5e7eb';
    var bg2 = style.getPropertyValue('--bg2').trim() || '#ffffff';

    // --- Daily Change Bar Chart ---
    var dailyEl = document.getElementById('chartDailyChange');
    if (!chartDaily) {
      chartDaily = echarts.init(dailyEl, null, { renderer: 'svg' });
    }

    var catData = {};
    data.holdings.forEach(function (h) {
      if (!catData[h.category1]) {
        catData[h.category1] = { profit: 0, amount: 0 };
      }
      catData[h.category1].profit += h.todayProfit;
      catData[h.category1].amount += h.amount;
    });

    var catNames = Object.keys(catData);
    var profitData = catNames.map(function (k) { return catData[k].profit; });
    var changePctData = catNames.map(function (k) {
      var d = catData[k];
      return d.amount > 0 ? (d.profit / (d.amount - d.profit)) * 100 : 0;
    });

    chartDaily.setOption({
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        appendToBody: true,
        formatter: function (params) {
          var idx = params[0].dataIndex;
          var profit = profitData[idx];
          var pct = changePctData[idx];
          var sign = profit >= 0 ? '+' : '';
          return params[0].name + '<br/>收益: ' + sign + '¥' + profit.toFixed(2) +
            '<br/>涨跌幅: ' + sign + pct.toFixed(2) + '%';
        }
      },
      grid: { left: '3%', right: '8%', bottom: '3%', top: '10%', containLabel: true },
      xAxis: {
        type: 'value',
        axisLine: { lineStyle: { color: rule } },
        axisLabel: { color: muted, fontSize: 11, formatter: function (v) { return '¥' + v.toFixed(0); } },
        splitLine: { lineStyle: { color: rule, type: 'dashed' } }
      },
      yAxis: {
        type: 'category',
        data: catNames,
        axisLine: { lineStyle: { color: rule } },
        axisLabel: { color: ink, fontSize: 13, fontWeight: 600 }
      },
      series: [{
        type: 'bar',
        data: profitData.map(function (v) {
          return {
            value: v,
            itemStyle: { color: v >= 0 ? gain : loss, borderRadius: [0, 4, 4, 0] }
          };
        }),
        barWidth: '50%',
        label: {
          show: true,
          position: 'right',
          formatter: function (p) {
            var pct = changePctData[p.dataIndex];
            var sign = pct >= 0 ? '+' : '';
            return sign + pct.toFixed(2) + '%';
          },
          color: muted,
          fontSize: 11
        },
        animation: false
      }]
    });

    // --- Allocation Pie Chart ---
    var allocEl = document.getElementById('chartAllocation');
    if (!chartAlloc) {
      chartAlloc = echarts.init(allocEl, null, { renderer: 'svg' });
    }

    var allocData = catNames.map(function (k) {
      return { name: k, value: catData[k].amount };
    });

    var pieColors = [accent, accent2, warn, gain, loss, '#6366f1'];

    chartAlloc.setOption({
      tooltip: {
        trigger: 'item',
        appendToBody: true,
        formatter: function (p) {
          return p.name + '<br/>¥' + p.value.toFixed(2) + ' (' + p.percent.toFixed(1) + '%)';
        }
      },
      legend: {
        bottom: 5,
        left: 'center',
        textStyle: { color: muted, fontSize: 12 },
        itemWidth: 12,
        itemHeight: 12
      },
      series: [{
        type: 'pie',
        radius: ['40%', '65%'],
        center: ['50%', '45%'],
        data: allocData,
        itemStyle: { borderRadius: 6, borderColor: bg2, borderWidth: 2 },
        label: {
          show: true,
          formatter: function (p) { return p.percent.toFixed(1) + '%'; },
          color: ink,
          fontSize: 12,
          fontWeight: 600
        },
        color: pieColors,
        animation: false
      }]
    });

    // --- Trend Line Chart ---
    var trendEl = document.getElementById('chartTrend');
    if (!chartTrend) {
      chartTrend = echarts.init(trendEl, null, { renderer: 'svg' });
    }

    var sortedTrend = data.trendData.slice().sort(function (a, b) {
      return new Date(a.date) - new Date(b.date);
    });

    var dates = sortedTrend.map(function (d) { return d.date; });

    chartTrend.setOption({
      tooltip: {
        trigger: 'axis',
        appendToBody: true,
        formatter: function (params) {
          var html = params[0].axisValue + '<br/>';
          params.forEach(function (p) {
            html += p.marker + ' ' + p.seriesName + ': ' + (p.value >= 0 ? '+' : '') + p.value.toFixed(2) + '%<br/>';
          });
          return html;
        }
      },
      legend: {
        top: 5,
        left: 'center',
        textStyle: { color: muted, fontSize: 12 },
        itemWidth: 16,
        itemHeight: 8
      },
      grid: { left: '3%', right: '4%', bottom: '8%', top: '15%', containLabel: true },
      xAxis: {
        type: 'category',
        data: dates,
        boundaryGap: false,
        axisLine: { lineStyle: { color: rule } },
        axisLabel: { color: muted, fontSize: 11 }
      },
      yAxis: {
        type: 'value',
        axisLine: { show: false },
        axisLabel: {
          color: muted,
          fontSize: 11,
          formatter: function (v) { return v.toFixed(1) + '%'; }
        },
        splitLine: { lineStyle: { color: rule, type: 'dashed' } }
      },
      series: [
        {
          name: '我的组合',
          type: 'line',
          data: sortedTrend.map(function (d) { return d.portfolio || 0; }),
          lineStyle: { width: 2.5, color: accent },
          itemStyle: { color: accent },
          symbol: 'circle',
          symbolSize: 5
        },
        {
          name: '沪深300',
          type: 'line',
          data: sortedTrend.map(function (d) { return d.csi300 || 0; }),
          lineStyle: { width: 1.5, color: loss, type: 'dashed' },
          itemStyle: { color: loss },
          symbol: 'none'
        },
        {
          name: '中证500',
          type: 'line',
          data: sortedTrend.map(function (d) { return d.csi500 || 0; }),
          lineStyle: { width: 1.5, color: warn, type: 'dashed' },
          itemStyle: { color: warn },
          symbol: 'none'
        },
        {
          name: '纳斯达克100',
          type: 'line',
          data: sortedTrend.map(function (d) { return d.nasdaq || 0; }),
          lineStyle: { width: 1.5, color: accent2, type: 'dashed' },
          itemStyle: { color: accent2 },
          symbol: 'none'
        },
        {
          name: '黄金ETF',
          type: 'line',
          data: sortedTrend.map(function (d) { return d.gold || 0; }),
          lineStyle: { width: 1.5, color: gain, type: 'dashed' },
          itemStyle: { color: gain },
          symbol: 'none'
        }
      ],
      animation: false
    });
  }

  // === Trend Data ===
  window.openTrendModal = function () {
    document.getElementById('tDate').value = new Date().toISOString().slice(0, 10);
    document.getElementById('tPortfolio').value = '';
    document.getElementById('tCSI300').value = '';
    document.getElementById('tCSI500').value = '';
    document.getElementById('tNasdaq').value = '';
    document.getElementById('tGold').value = '';
    openModal('trendModal');
  };

  window.saveTrendPoint = function () {
    var date = document.getElementById('tDate').value;
    if (!date) {
      showToast('请选择日期');
      return;
    }

    var existing = data.trendData.find(function (d) { return d.date === date; });
    var point = {
      date: date,
      portfolio: parseFloat(document.getElementById('tPortfolio').value) || 0,
      csi300: parseFloat(document.getElementById('tCSI300').value) || 0,
      csi500: parseFloat(document.getElementById('tCSI500').value) || 0,
      nasdaq: parseFloat(document.getElementById('tNasdaq').value) || 0,
      gold: parseFloat(document.getElementById('tGold').value) || 0
    };

    if (existing) {
      Object.assign(existing, point);
      showToast('已更新数据点');
    } else {
      data.trendData.push(point);
      showToast('已添加数据点');
    }

    saveData();
    closeModal('trendModal');
    renderTrendList();
    renderCharts();
  };

  window.clearTrendData = function () {
    if (!confirm('确认清空所有走势数据？此操作不可撤销。')) return;
    data.trendData = [];
    saveData();
    renderTrendList();
    renderCharts();
    showToast('已清空');
  };

  window.deleteTrendPoint = function (date) {
    data.trendData = data.trendData.filter(function (d) { return d.date !== date; });
    saveData();
    renderTrendList();
    renderCharts();
    showToast('已删除');
  };

  function renderTrendList() {
    var el = document.getElementById('trendDataList');
    if (data.trendData.length === 0) {
      el.innerHTML = '<div style="padding:1rem;text-align:center">暂无走势数据，点击「添加数据点」记录历史收益率</div>';
      return;
    }

    var sorted = data.trendData.slice().sort(function (a, b) {
      return new Date(b.date) - new Date(a.date);
    });

    var html = '<table style="width:100%;font-size:0.82rem"><thead><tr>' +
      '<th style="text-align:left;padding:0.4rem">日期</th>' +
      '<th style="text-align:right;padding:0.4rem">组合</th>' +
      '<th style="text-align:right;padding:0.4rem">沪深300</th>' +
      '<th style="text-align:right;padding:0.4rem">中证500</th>' +
      '<th style="text-align:right;padding:0.4rem">纳指100</th>' +
      '<th style="text-align:right;padding:0.4rem">黄金</th>' +
      '<th style="padding:0.4rem"></th>' +
      '</tr></thead><tbody>';

    sorted.forEach(function (d) {
      html += '<tr style="border-bottom:1px solid var(--rule)">' +
        '<td style="padding:0.4rem">' + d.date + '</td>' +
        '<td style="text-align:right;padding:0.4rem;font-family:var(--font-mono);color:' + (d.portfolio >= 0 ? 'var(--gain)' : 'var(--loss)') + '">' + (d.portfolio >= 0 ? '+' : '') + d.portfolio.toFixed(2) + '%</td>' +
        '<td style="text-align:right;padding:0.4rem;font-family:var(--font-mono);color:var(--muted)">' + (d.csi300 >= 0 ? '+' : '') + d.csi300.toFixed(2) + '%</td>' +
        '<td style="text-align:right;padding:0.4rem;font-family:var(--font-mono);color:var(--muted)">' + (d.csi500 >= 0 ? '+' : '') + d.csi500.toFixed(2) + '%</td>' +
        '<td style="text-align:right;padding:0.4rem;font-family:var(--font-mono);color:var(--muted)">' + (d.nasdaq >= 0 ? '+' : '') + d.nasdaq.toFixed(2) + '%</td>' +
        '<td style="text-align:right;padding:0.4rem;font-family:var(--font-mono);color:var(--muted)">' + (d.gold >= 0 ? '+' : '') + d.gold.toFixed(2) + '%</td>' +
        '<td style="padding:0.4rem"><button class="btn btn-danger btn-sm" onclick="deleteTrendPoint(\'' + d.date + '\')">删除</button></td>' +
        '</tr>';
    });

    html += '</tbody></table>';
    el.innerHTML = html;
  }

  // === Import/Export ===
  window.exportData = function () {
    var blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'portfolio-data-' + new Date().toISOString().slice(0, 10) + '.json';
    a.click();
    URL.revokeObjectURL(url);
    showToast('数据已导出');
  };

  window.importData = function (event) {
    var file = event.target.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function (e) {
      try {
        var imported = JSON.parse(e.target.result);
        if (imported.holdings) data.holdings = imported.holdings;
        if (imported.valuation) data.valuation = imported.valuation;
        if (imported.trendData) data.trendData = imported.trendData;
        if (imported.settings) data.settings = imported.settings;
        saveData();
        renderAll();
        showToast('数据已导入');
      } catch (err) {
        showToast('导入失败：文件格式错误');
      }
    };
    reader.readAsText(file);
    event.target.value = '';
  };

  // === Sample Data ===
  window.loadSampleData = function () {
    if (data.holdings.length > 0) {
      if (!confirm('当前已有持仓数据，加载示例数据将覆盖现有数据。是否继续？')) return;
    }

    var today = new Date();
    var startDate = new Date(today);
    startDate.setMonth(startDate.getMonth() - 5);

    data.holdings = [
      { id: 1, category1: '股票', category2: '美股', name: '南方纳斯达克100指数发起(QDII)', amount: 109790.59, todayProfit: 520.35, todayChange: 0.47, todayAction: '无' },
      { id: 2, category1: '股票', category2: '美股', name: '广发纳斯达克100ETF联接A', amount: 45230.18, todayProfit: 198.66, todayChange: 0.44, todayAction: '无' },
      { id: 3, category1: '股票', category2: '美股', name: '华夏纳斯达克100ETF联接A', amount: 23450.00, todayProfit: 105.20, todayChange: 0.45, todayAction: '无' },
      { id: 4, category1: '股票', category2: 'A股', name: '红利低波50ETF', amount: 28900.00, todayProfit: 0, todayChange: 0, todayAction: '无' },
      { id: 5, category1: '股票', category2: 'A股', name: '现金添富ETF', amount: 15600.00, todayProfit: 0, todayChange: 0, todayAction: '无' },
      { id: 6, category1: '股票', category2: '全球', name: '易方达全球成长精选', amount: 20136.82, todayProfit: -38.21, todayChange: -0.19, todayAction: '无' },
      { id: 7, category1: '债券', category2: '中长债', name: '南方中债7-10年国开行债券指数A', amount: 149985.00, todayProfit: 0, todayChange: 0, todayAction: '无' },
      { id: 8, category1: '债券', category2: '短债', name: '上银慧添利90天持有期债券A', amount: 49663.00, todayProfit: 0, todayChange: 0, todayAction: '无' },
      { id: 9, category1: '黄金', category2: '黄金ETF', name: '国泰黄金ETF联接A', amount: 106337.00, todayProfit: -316.51, todayChange: -0.25, todayAction: '无' },
      { id: 10, category1: '现金', category2: '货币基金', name: '朝朝宝', amount: 21669.00, todayProfit: 0, todayChange: 0, todayAction: '无' }
    ];

    data.settings = {
      startDate: startDate.toISOString().slice(0, 10),
      initialCapital: 567068.85,
      maxDrawdown: -5.76
    };

    // 手动估值作为云端数据不可用时的兜底（PB 无自动数据源，始终需要手动）
    data.valuation = { pe: 64, pb: 95, ps: null, vix: null };

    var trendDates = [];
    var d = new Date(startDate);
    while (d <= today) {
      trendDates.push(d.toISOString().slice(0, 10));
      d.setDate(d.getDate() + 14);
    }

    var portfolioVals = [0, -0.5, -1.2, -0.8, 0.3, 1.1, 0.5, -0.2, 0.8, 0.65];
    var csi300Vals = [0, -0.8, -1.5, -2.1, -2.8, -3.2, -3.5, -4.0, -4.1, -4.18];
    var csi500Vals = [0, 2.1, 4.5, 6.8, 9.2, 11.5, 13.8, 15.2, 16.5, 17.99];
    var nasdaqVals = [0, 1.5, 3.2, 2.1, 4.5, 5.8, 4.2, 6.1, 5.5, 5.99];
    var goldVals = [0, 3.2, 6.5, 9.8, 12.1, 15.5, 18.2, 21.5, 23.8, 25.60];

    data.trendData = trendDates.map(function (date, i) {
      var idx = Math.min(i, portfolioVals.length - 1);
      return {
        date: date,
        portfolio: portfolioVals[idx],
        csi300: csi300Vals[idx],
        csi500: csi500Vals[idx],
        nasdaq: nasdaqVals[idx],
        gold: goldVals[idx]
      };
    });

    saveData();
    renderAll();
    showToast('示例数据已加载');
  };

  // === Helpers ===
  function formatMoney(v) {
    return v.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }

  function esc(s) {
    if (s == null) return '';
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function formatDate(d) {
    var y = d.getFullYear();
    var m = String(d.getMonth() + 1).padStart(2, '0');
    var day = String(d.getDate()).padStart(2, '0');
    var week = ['日', '一', '二', '三', '四', '五', '六'][d.getDay()];
    return y + '-' + m + '-' + day + ' 星期' + week;
  }

  // === Render All ===
  function renderAll() {
    document.getElementById('headerDate').textContent = formatDate(new Date());
    renderHoldingsTable();
    renderSummary();
    renderValuation();
    renderCharts();
    renderTrendList();
  }

  // === Init ===
  document.addEventListener('DOMContentLoaded', function () {
    renderAll();

    // 加载云端估值数据（GitHub Pages 上可用；本地 file:// 打开会失败并回退手动模式）
    fetchCloudValuation()
      .then(function (j) {
        cloudValuation = j;
        renderValuation();
      })
      .catch(function () {
        renderValuation(); // 手动模式
      });

    window.addEventListener('resize', function () {
      if (chartDaily) chartDaily.resize();
      if (chartAlloc) chartAlloc.resize();
      if (chartTrend) chartTrend.resize();
    });

    document.querySelectorAll('.modal-overlay').forEach(function (overlay) {
      overlay.addEventListener('click', function (e) {
        if (e.target === overlay) {
          overlay.classList.remove('active');
        }
      });
    });
  });

})();
