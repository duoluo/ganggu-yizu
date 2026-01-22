// 乙组投资追踪器 - 主脚本
let investmentData = null;

// 页面加载时初始化
document.addEventListener('DOMContentLoaded', async function() {
    try {
        // 加载数据
        const response = await fetch('data.json');
        investmentData = await response.json();

        // 初始化页面
        initializePage();
    } catch (error) {
        console.error('加载数据失败:', error);
        alert('数据加载失败，请确保 data.json 文件存在！');
    }
});

// 初始化页面
function initializePage() {
    // 计算统计数据
    const stats = calculateStats();

    // 更新时间
    document.getElementById('updateTime').textContent = `数据更新时间: ${investmentData.generated_at}`;

    // 更新统计卡片
    updateStatsCards(stats);

    // 初始化图表
    initializeCharts();

    // 更新表格
    updateProfitTable();
    updateLossTable();
    updateNotWonTable();

    // 更新收益分配
    updateDistribution(stats);
}

// 计算统计数据
function calculateStats() {
    // 盈利股票总额
    const totalProfit = investmentData.profit_stocks.reduce((sum, stock) => sum + stock.revenue, 0);

    // 亏损股票总额
    const totalLoss = investmentData.loss_stocks.reduce((sum, stock) => sum + stock.loss, 0);

    // 未中签费用总额
    const totalNotWonCost = investmentData.not_won_stocks.reduce((sum, stock) => sum + stock.cost, 0);

    // 总成本 = 亏损 + 未中签费用
    const totalCost = totalLoss + totalNotWonCost;

    // 净收益 = 盈利 - 总成本
    const netProfit = totalProfit - totalCost;

    // 操作方收益（40%）
    const operatorProfit = netProfit * investmentData.operator_share;

    // 投资方总收益（60%）
    const investorTotalProfit = netProfit * investmentData.investor_share;

    // 投资方总投资额
    const totalInvestment = investmentData.investors.reduce((sum, inv) => sum + inv.investment, 0);
    const specialTotalInvestment = investmentData.special_investors.reduce((sum, inv) => sum + inv.investment, 0);

    // 计算每个投资方的收益（需要区分普通股票和特殊股票）
    const investorProfits = investmentData.investors.map(investor => {
        const specialInvestor = investmentData.special_investors.find(si => si.name === investor.name);

        // 普通股票的净收益
        let normalProfit = 0;
        let specialProfit = 0;

        investmentData.profit_stocks.forEach(stock => {
            const stockNetProfit = stock.revenue * investmentData.investor_share;
            if (stock.special_investors) {
                // 特殊股票使用特殊投资比例
                specialProfit += (specialInvestor.investment / specialTotalInvestment) * stockNetProfit;
            } else {
                // 普通股票使用普通投资比例
                normalProfit += (investor.investment / totalInvestment) * stockNetProfit;
            }
        });

        // 亏损和未中签费用按普通比例分摊
        const costShare = (investor.investment / totalInvestment) * (totalCost * investmentData.investor_share);

        return {
            name: investor.name,
            investment: investor.investment,
            profit: normalProfit + specialProfit - costShare
        };
    });

    return {
        totalProfit,
        totalLoss,
        totalNotWonCost,
        totalCost,
        netProfit,
        operatorProfit,
        investorTotalProfit,
        investorProfits,
        profitStockCount: investmentData.profit_stocks.length,
        lossStockCount: investmentData.loss_stocks.length,
        notWonStockCount: investmentData.not_won_stocks.length
    };
}

// 更新统计卡片
function updateStatsCards(stats) {
    const html = `
        <div class="stat-card success">
            <div class="label">盈利总额</div>
            <div class="value">¥${formatNumber(stats.totalProfit)}</div>
        </div>
        <div class="stat-card danger">
            <div class="label">亏损总额</div>
            <div class="value">¥${formatNumber(stats.totalLoss)}</div>
        </div>
        <div class="stat-card warning">
            <div class="label">未中签费用</div>
            <div class="value">¥${formatNumber(stats.totalNotWonCost)}</div>
        </div>
        <div class="stat-card info">
            <div class="label">净收益</div>
            <div class="value">¥${formatNumber(stats.netProfit)}</div>
        </div>
        <div class="stat-card success">
            <div class="label">操作方收益</div>
            <div class="value">¥${formatNumber(stats.operatorProfit)}</div>
        </div>
        <div class="stat-card info">
            <div class="label">投资方收益</div>
            <div class="value">¥${formatNumber(stats.investorTotalProfit)}</div>
        </div>
    `;
    document.getElementById('statsCards').innerHTML = html;
}

// 初始化图表
function initializeCharts() {
    // 盈利股票饼图
    const profitPieCtx = document.getElementById('profitPieChart').getContext('2d');
    const sortedProfitStocks = [...investmentData.profit_stocks].sort((a, b) => b.revenue - a.revenue);

    // 显示前10名，其他合并
    const top10Profit = sortedProfitStocks.slice(0, 10);
    const othersProfit = sortedProfitStocks.slice(10);
    const othersProfitSum = othersProfit.reduce((sum, s) => sum + s.revenue, 0);

    const profitPieLabels = top10Profit.map(s => s.name);
    const profitPieData = top10Profit.map(s => s.revenue);

    if (othersProfitSum > 0) {
        profitPieLabels.push('其他');
        profitPieData.push(othersProfitSum);
    }

    new Chart(profitPieCtx, {
        type: 'pie',
        data: {
            labels: profitPieLabels,
            datasets: [{
                data: profitPieData,
                backgroundColor: [
                    '#27ae60', '#2ecc71', '#16a085', '#1abc9c', '#3498db',
                    '#2980b9', '#9b59b6', '#8e44ad', '#34495e', '#2c3e50', '#95a5a6'
                ]
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'right',
                    labels: {
                        boxWidth: 12,
                        font: { size: 10 }
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const value = context.parsed;
                            const total = context.dataset.data.reduce((a, b) => a + b, 0);
                            const percentage = ((value / total) * 100).toFixed(1);
                            return `${context.label}: ¥${formatNumber(value)} (${percentage}%)`;
                        }
                    }
                }
            }
        }
    });

    // 盈利股票柱状图
    const profitBarCtx = document.getElementById('profitBarChart').getContext('2d');
    const top15Profit = sortedProfitStocks.slice(0, 15);

    new Chart(profitBarCtx, {
        type: 'bar',
        data: {
            labels: top15Profit.map(s => s.name.length > 15 ? s.name.substring(0, 15) + '...' : s.name),
            datasets: [{
                label: '盈利（元）',
                data: top15Profit.map(s => s.revenue),
                backgroundColor: '#27ae60'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return `盈利: ¥${formatNumber(context.parsed.y)}`;
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) {
                            return '¥' + formatNumber(value);
                        }
                    }
                },
                x: {
                    ticks: {
                        font: { size: 10 }
                    }
                }
            }
        }
    });

    // 亏损股票饼图
    const lossPieCtx = document.getElementById('lossPieChart').getContext('2d');
    const sortedLossStocks = [...investmentData.loss_stocks].sort((a, b) => b.loss - a.loss);

    new Chart(lossPieCtx, {
        type: 'pie',
        data: {
            labels: sortedLossStocks.map(s => s.name),
            datasets: [{
                data: sortedLossStocks.map(s => s.loss),
                backgroundColor: [
                    '#e74c3c', '#c0392b', '#e67e22', '#d35400', '#f39c12',
                    '#f1c40f', '#e8b4b8', '#d98880'
                ]
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'right',
                    labels: {
                        boxWidth: 12,
                        font: { size: 10 }
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const value = context.parsed;
                            const total = context.dataset.data.reduce((a, b) => a + b, 0);
                            const percentage = ((value / total) * 100).toFixed(1);
                            return `${context.label}: ¥${formatNumber(value)} (${percentage}%)`;
                        }
                    }
                }
            }
        }
    });

    // 亏损股票柱状图
    const lossBarCtx = document.getElementById('lossBarChart').getContext('2d');

    new Chart(lossBarCtx, {
        type: 'bar',
        data: {
            labels: sortedLossStocks.map(s => s.name.length > 15 ? s.name.substring(0, 15) + '...' : s.name),
            datasets: [{
                label: '亏损（元）',
                data: sortedLossStocks.map(s => s.loss),
                backgroundColor: '#e74c3c'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return `亏损: ¥${formatNumber(context.parsed.y)}`;
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) {
                            return '¥' + formatNumber(value);
                        }
                    }
                },
                x: {
                    ticks: {
                        font: { size: 10 }
                    }
                }
            }
        }
    });
}

// 更新盈利股票表格
function updateProfitTable() {
    const sortedStocks = [...investmentData.profit_stocks].sort((a, b) => b.revenue - a.revenue);
    const tbody = document.getElementById('profitTableBody');

    tbody.innerHTML = sortedStocks.map((stock, index) => `
        <tr>
            <td>${index + 1}</td>
            <td><strong>${stock.name}</strong></td>
            <td class="positive">¥${formatNumber(stock.revenue)}</td>
        </tr>
    `).join('');
}

// 更新亏损股票表格
function updateLossTable() {
    const sortedStocks = [...investmentData.loss_stocks].sort((a, b) => b.loss - a.loss);
    const tbody = document.getElementById('lossTableBody');

    tbody.innerHTML = sortedStocks.map((stock, index) => `
        <tr>
            <td>${index + 1}</td>
            <td><strong>${stock.name}</strong></td>
            <td class="negative">¥${formatNumber(stock.loss)}</td>
        </tr>
    `).join('');
}

// 更新未中签股票表格
function updateNotWonTable() {
    const tbody = document.getElementById('notWonTableBody');

    tbody.innerHTML = investmentData.not_won_stocks.map((stock, index) => `
        <tr>
            <td>${index + 1}</td>
            <td><strong>${stock.name}</strong></td>
            <td>${stock.cost > 0 ? '¥' + formatNumber(stock.cost) : '¥0.00'}</td>
        </tr>
    `).join('');
}

// 更新收益分配
function updateDistribution(stats) {
    // 操作方收益
    document.getElementById('operatorAmount').textContent = `¥${formatNumber(stats.operatorProfit)}`;

    // 投资方收益分配
    const investorHtml = stats.investorProfits.map(investor => {
        // 根据投资人判断显示的投资金额说明
        let investmentNote = '';
        if (investor.name === '雅男') {
            investmentNote = '（2025.12.09前投资 ¥250,000，之后撤资）';
        } else if (investor.name === '妍妍') {
            investmentNote = '（2025.12.09前投资 ¥150,000，之后追加至 ¥300,000）';
        } else if (investor.name === '文博') {
            investmentNote = '（2025.12.09前投资 ¥100,000，之后追加至 ¥150,000）';
        } else if (investor.name === '李焱') {
            investmentNote = '（2025.12.09后新增投资 ¥50,000）';
        } else {
            investmentNote = `（投资 ¥${formatNumber(investor.investment)}）`;
        }

        return `
            <div class="distribution-item">
                <div class="d-flex justify-content-between align-items-center w-100">
                    <span class="name">${investor.name}${investmentNote}</span>
                    <div class="d-flex align-items-center gap-2">
                        <span class="amount">¥${formatNumber(investor.profit)}</span>
                        <button class="btn btn-sm btn-outline-primary" onclick="showInvestorDetails('${investor.name}')" style="white-space: nowrap;">查看详情</button>
                    </div>
                </div>
            </div>
        `;
    }).join('');

    document.getElementById('investorDistribution').innerHTML = investorHtml;
}

// 显示操作方收益详情
function showOperatorDetails() {
    const totalInvestment = investmentData.investors.reduce((sum, inv) => sum + inv.investment, 0);
    const specialTotalInvestment = investmentData.special_investors.reduce((sum, inv) => sum + inv.investment, 0);

    let detailsHtml = '<h5 class="mb-3">操作方收益详情（40%）</h5>';
    detailsHtml += '<div class="table-responsive"><table class="table table-sm table-hover">';
    detailsHtml += '<thead><tr><th>股票名称</th><th>盈利/亏损</th><th>操作方收益</th></tr></thead><tbody>';

    // 盈利股票
    investmentData.profit_stocks.forEach(stock => {
        const operatorShare = stock.revenue * investmentData.operator_share;
        detailsHtml += `
            <tr>
                <td><strong>${stock.name}</strong></td>
                <td class="positive">¥${formatNumber(stock.revenue)}</td>
                <td class="positive">¥${formatNumber(operatorShare)}</td>
            </tr>
        `;
    });

    // 亏损股票
    investmentData.loss_stocks.forEach(stock => {
        const operatorShare = -stock.loss * investmentData.operator_share;
        detailsHtml += `
            <tr>
                <td><strong>${stock.name}</strong></td>
                <td class="negative">-¥${formatNumber(stock.loss)}</td>
                <td class="negative">-¥${formatNumber(stock.loss * investmentData.operator_share)}</td>
            </tr>
        `;
    });

    // 未中签费用
    investmentData.not_won_stocks.forEach(stock => {
        if (stock.cost > 0) {
            const operatorShare = -stock.cost * investmentData.operator_share;
            detailsHtml += `
                <tr>
                    <td><strong>${stock.name}（未中签）</strong></td>
                    <td class="negative">-¥${formatNumber(stock.cost)}</td>
                    <td class="negative">-¥${formatNumber(stock.cost * investmentData.operator_share)}</td>
                </tr>
            `;
        }
    });

    detailsHtml += '</tbody></table></div>';

    document.getElementById('detailsModalBody').innerHTML = detailsHtml;
    const modal = new bootstrap.Modal(document.getElementById('detailsModal'));
    modal.show();
}

// 显示投资方收益详情
function showInvestorDetails(investorName) {
    const totalInvestment = investmentData.investors.reduce((sum, inv) => sum + inv.investment, 0);
    const specialTotalInvestment = investmentData.special_investors.reduce((sum, inv) => sum + inv.investment, 0);

    const investor = investmentData.investors.find(inv => inv.name === investorName);
    const specialInvestor = investmentData.special_investors.find(si => si.name === investorName);

    if (!investor) return;

    let detailsHtml = `<h5 class="mb-3">${investor.name} 的收益详情</h5>`;

    // 根据投资人显示不同的投资金额说明
    if (investorName === '雅男') {
        detailsHtml += `<p class="text-muted">投资金额：2025.12.09前 ¥250,000，之后撤资至 ¥0</p>`;
    } else if (investorName === '妍妍') {
        detailsHtml += `<p class="text-muted">投资金额：2025.12.09前 ¥150,000，之后追加至 ¥300,000</p>`;
    } else if (investorName === '文博') {
        detailsHtml += `<p class="text-muted">投资金额：2025.12.09前 ¥100,000，之后追加至 ¥150,000</p>`;
    } else if (investorName === '李焱') {
        detailsHtml += `<p class="text-muted">投资金额：2025.12.09后新增投资 ¥50,000</p>`;
    } else {
        detailsHtml += `<p class="text-muted">投资金额：¥${formatNumber(investor.investment)}</p>`;
    }

    detailsHtml += '<div class="table-responsive"><table class="table table-sm table-hover">';
    detailsHtml += '<thead><tr><th>股票名称</th><th>盈利/亏损</th><th>个人收益</th></tr></thead><tbody>';

    let totalPersonalProfit = 0;

    // 盈利股票
    investmentData.profit_stocks.forEach(stock => {
        const investorShareTotal = stock.revenue * investmentData.investor_share;
        let personalShare;

        if (stock.special_investors) {
            // 特殊股票
            personalShare = (specialInvestor.investment / specialTotalInvestment) * investorShareTotal;
        } else {
            // 普通股票
            personalShare = (investor.investment / totalInvestment) * investorShareTotal;
        }

        if (personalShare > 0) {
            totalPersonalProfit += personalShare;
            detailsHtml += `
                <tr>
                    <td><strong>${stock.name}${stock.special_investors ? ' <span class="badge bg-warning text-dark">2025.12.09后</span>' : ''}</strong></td>
                    <td class="positive">¥${formatNumber(stock.revenue)}</td>
                    <td class="positive">¥${formatNumber(personalShare)}</td>
                </tr>
            `;
        }
    });

    // 亏损股票（按普通比例分摊）
    investmentData.loss_stocks.forEach(stock => {
        const investorShareTotal = stock.loss * investmentData.investor_share;
        const personalShare = (investor.investment / totalInvestment) * investorShareTotal;

        totalPersonalProfit -= personalShare;
        detailsHtml += `
            <tr>
                <td><strong>${stock.name}</strong></td>
                <td class="negative">-¥${formatNumber(stock.loss)}</td>
                <td class="negative">-¥${formatNumber(personalShare)}</td>
            </tr>
        `;
    });

    // 未中签费用（按普通比例分摊）
    investmentData.not_won_stocks.forEach(stock => {
        if (stock.cost > 0) {
            const investorShareTotal = stock.cost * investmentData.investor_share;
            const personalShare = (investor.investment / totalInvestment) * investorShareTotal;

            totalPersonalProfit -= personalShare;
            detailsHtml += `
                <tr>
                    <td><strong>${stock.name}（未中签）</strong></td>
                    <td class="negative">-¥${formatNumber(stock.cost)}</td>
                    <td class="negative">-¥${formatNumber(personalShare)}</td>
                </tr>
            `;
        }
    });

    detailsHtml += `
        <tr class="table-primary fw-bold">
            <td colspan="2">总计</td>
            <td class="${totalPersonalProfit >= 0 ? 'positive' : 'negative'}">¥${formatNumber(totalPersonalProfit)}</td>
        </tr>
    `;
    detailsHtml += '</tbody></table></div>';

    detailsHtml += '<div class="alert alert-info mt-3">';
    detailsHtml += '<p class="mb-0"><small><strong>说明：</strong></small></p>';
    detailsHtml += '<ul class="mb-0 small">';
    detailsHtml += '<li>标记为"2025.12.09后"的股票使用调整后的投资比例（雅男撤资25w，妍妍追加15w，文博追加5w，李焱新增5w）</li>';
    detailsHtml += '<li>亏损和未中签费用按2025.12.09前的原始投资比例分摊</li>';
    detailsHtml += '<li>分配比例：操作方 50%，投资方 50%</li>';
    detailsHtml += '</ul>';
    detailsHtml += '</div>';

    document.getElementById('detailsModalBody').innerHTML = detailsHtml;
    const modal = new bootstrap.Modal(document.getElementById('detailsModal'));
    modal.show();
}

// 退出登录
function logout() {
    sessionStorage.removeItem('authenticated');
    window.location.href = 'index.html';
}

// 格式化数字
function formatNumber(num) {
    if (num === null || num === undefined) return '0.00';
    return num.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}
