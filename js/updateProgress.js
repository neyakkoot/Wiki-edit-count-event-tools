// பிழை சரி செய்யப்பட்ட முழு JavaScript குறியீடு:

// முதலில், உலகளாவிய செயல்பாடுகளை வரையறுக்கவும்
function updateProgress(percentage, message, details = '') {
    const progressBar = document.getElementById('progressBar');
    const progressText = document.getElementById('progressText');
    const loadingDetails = document.getElementById('loadingDetails');
    
    if (progressBar) {
        progressBar.style.width = `${percentage}%`;
    }
    if (progressText && message) {
        progressText.textContent = message;
    }
    if (loadingDetails && details) {
        loadingDetails.textContent = details;
    }
}

function showStatus(message, type = 'info') {
    const statusMessage = document.getElementById('statusMessage');
    if (!statusMessage) return;
    
    statusMessage.textContent = message;
    statusMessage.className = `status-message status-${type}`;
    statusMessage.style.display = 'block';
    
    if (type !== 'error') {
        setTimeout(() => {
            statusMessage.style.display = 'none';
        }, 5000);
    }
}

function showLoading(show, message = '') {
    const loadingDiv = document.getElementById('loading');
    const progressText = document.getElementById('progressText');
    
    if (loadingDiv) {
        loadingDiv.style.display = show ? 'block' : 'none';
    }
    if (progressText && message) {
        progressText.textContent = message;
    }
}

// முழுமையான பங்களிப்பு பகுப்பாய்வு வகுப்பு
class CompleteContributionsAnalyzer {
    constructor() {
        this.contributions = new Map();
        this.projects = new Map();
        this.userStats = new Map();
        this.selectedProjects = Array.from(document.getElementById('projectsSelect').selectedOptions)
            .map(opt => ({
                domain: opt.value,
                name: opt.text
            }));
        this.contributionLimit = parseInt(document.getElementById('contributionLimit').value) || 5000;
    }

    async analyzeEvent(participants, startDate, endDate) {
        showLoading(true, 'தயாராகிறது...');
        updateProgress(0, 'தொடங்குகிறது...', '');
        
        const users = Array.from(participants);
        const totalUsers = users.length;
        let totalContributions = 0;
        let totalAPICalls = 0;
        
        for (let i = 0; i < users.length; i++) {
            const username = users[i];
            const progressPercent = Math.round(((i + 1) / totalUsers) * 100);
            
            updateProgress(
                progressPercent, 
                `${username} - முழுமையான பங்களிப்புகளைப் பெறுகிறது`,
                `பயனர் ${i + 1}/${totalUsers} | மொத்த பங்களிப்புகள்: ${totalContributions}`
            );
            
            try {
                const userContribs = await this.fetchCompleteUserContributions(username, startDate, endDate);
                totalAPICalls += userContribs.apiCalls || 0;
                
                if (userContribs.contributions && userContribs.contributions.length > 0) {
                    this.addContributions(username, userContribs.contributions);
                    totalContributions += userContribs.contributions.length;
                    
                    showStatus(
                        `${username}: ${userContribs.contributions.length} பங்களிப்புகள் (API அழைப்புகள்: ${userContribs.apiCalls})`, 
                        'success'
                    );
                    
                    // API rate limiting ஐத் தவிர்க்க
                    await this.delay(500);
                    
                } else {
                    showStatus(`${username}: பங்களிப்புகள் கிடைக்கவில்லை`, 'info');
                }
                
            } catch (error) {
                console.error(`${username} பிழை:`, error);
                showStatus(`${username}: தவறு - ${error.message}`, 'error');
            }
        }
        
        showLoading(false);
        
        showStatus(
            `பகுப்பாய்வு முடிந்தது! ${totalContributions} மொத்த பங்களிப்புகள், ${totalAPICalls} API அழைப்புகள்`, 
            'success'
        );
        
        return this.generateReport(startDate, endDate, totalContributions, totalAPICalls);
    }

    async fetchCompleteUserContributions(username, startDate, endDate) {
        const allContributions = [];
        let totalAPICalls = 0;
        
        // ஒவ்வொரு திட்டத்திற்கும் பங்களிப்புகளைப் பெறுக
        for (const project of this.selectedProjects) {
            try {
                const projectResult = await this.fetchContributionsWithPagination(
                    username, 
                    project.domain, 
                    startDate, 
                    endDate
                );
                
                allContributions.push(...projectResult.contributions.map(contrib => ({
                    ...contrib,
                    project: project.name,
                    projectDomain: project.domain
                })));
                
                totalAPICalls += projectResult.apiCalls;
                
            } catch (error) {
                console.warn(`${username} - ${project.name}: ${error.message}`);
            }
        }
        
        return {
            contributions: allContributions,
            apiCalls: totalAPICalls
        };
    }

    async fetchContributionsWithPagination(username, domain, startDate, endDate) {
        const allContributions = [];
        let continueToken = null;
        let apiCalls = 0;
        let pageCount = 0;
        const maxPages = 10;
        
        do {
            try {
                const result = await this.fetchContributionsPage(
                    username, 
                    domain, 
                    startDate, 
                    endDate, 
                    continueToken
                );
                
                allContributions.push(...result.contributions);
                continueToken = result.continue;
                apiCalls++;
                pageCount++;
                
                // முன்னேற்ற விவரங்களைப் புதுப்பிக்க
                const progressText = document.getElementById('progressText');
                if (progressText) {
                    progressText.textContent = `${username} - ${domain}: பக்கம் ${pageCount}, மொத்தம் ${allContributions.length} திருத்தங்கள்`;
                }
                
                // API மீது அழுத்தம் குறைக்க
                if (pageCount < maxPages) {
                    await this.delay(200);
                } else {
                    break;
                }
                
            } catch (error) {
                console.error(`${username} - ${domain} பக்கம் ${pageCount + 1}: ${error.message}`);
                break;
            }
            
        } while (continueToken && pageCount < maxPages && allContributions.length < this.contributionLimit);
        
        return {
            contributions: allContributions.slice(0, this.contributionLimit),
            apiCalls: apiCalls
        };
    }

    async fetchContributionsPage(username, domain, startDate, endDate, continueToken = null) {
        const apiUrl = `https://${domain}/w/api.php`;
        
        // உயர்தர விருப்பங்களைப் பெறு
        const includeMinor = document.getElementById('includeMinor')?.checked || true;
        const includeBot = document.getElementById('includeBot')?.checked || true;
        
        const params = new URLSearchParams({
            action: 'query',
            list: 'usercontribs',
            ucuser: username,
            ucstart: startDate + 'T00:00:00Z',
            ucend: endDate + 'T23:59:59Z',
            uclimit: '500',
            ucprop: 'title|timestamp|comment|size|sizediff|flags|ids|tags',
            format: 'json',
            origin: '*'
        });
        
        // சிறு திருத்தங்களைச் சேர்க்க
        if (includeMinor) {
            params.append('ucshow', '!minor');
        } else {
            params.append('ucshow', 'minor');
        }
        
        // பாட் திருத்தங்களைச் சேர்க்க
        if (includeBot) {
            params.append('ucshow', '!bot');
        } else {
            params.append('ucshow', 'bot');
        }
        
        // Continue token சேர்க்க
        if (continueToken) {
            params.append('uccontinue', continueToken);
        }
        
        try {
            const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(apiUrl + '?' + params)}`;
            
            const response = await fetch(proxyUrl, {
                headers: {
                    'User-Agent': 'WikimediaCompleteAnalyzer/3.0',
                    'Accept': 'application/json'
                }
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            
            const data = await response.json();
            const jsonData = JSON.parse(data.contents);
            
            if (jsonData.error) {
                throw new Error(jsonData.error.info);
            }
            
            const contributions = jsonData.query?.usercontribs || [];
            const continueData = jsonData.continue?.uccontinue;
            
            return {
                contributions: contributions,
                continue: continueData
            };
            
        } catch (error) {
            console.error(`API பிழை: ${error.message}`);
            throw error;
        }
    }

    addContributions(username, contributions) {
        if (!this.userStats.has(username)) {
            this.userStats.set(username, {
                total: 0,
                minor: 0,
                bot: 0,
                new: 0,
                projects: new Map(),
                contributions: [],
                details: {
                    byHour: new Map(),
                    byDay: new Map(),
                    byProject: new Map()
                }
            });
        }
        
        const userStat = this.userStats.get(username);
        
        contributions.forEach(contrib => {
            userStat.total++;
            
            // விவரங்களைப் புதுப்பிக்கவும்
            if (contrib.minor) userStat.minor++;
            if (contrib.bot) userStat.bot++;
            if (contrib.new) userStat.new++;
            
            userStat.contributions.push(contrib);
            
            // திட்டம் வாரியான புள்ளிவிவரங்கள்
            const project = contrib.project;
            if (!userStat.projects.has(project)) {
                userStat.projects.set(project, 0);
            }
            userStat.projects.set(project, userStat.projects.get(project) + 1);
            
            // கால அடிப்படையில் புள்ளிவிவரங்கள்
            const timestamp = new Date(contrib.timestamp);
            const hour = timestamp.getHours();
            const day = timestamp.toISOString().split('T')[0];
            
            if (!userStat.details.byHour.has(hour)) {
                userStat.details.byHour.set(hour, 0);
            }
            userStat.details.byHour.set(hour, userStat.details.byHour.get(hour) + 1);
            
            if (!userStat.details.byDay.has(day)) {
                userStat.details.byDay.set(day, 0);
            }
            userStat.details.byDay.set(day, userStat.details.byDay.get(day) + 1);
            
            // மொத்த திட்ட புள்ளிவிவரங்கள்
            if (!this.projects.has(project)) {
                this.projects.set(project, {
                    total: 0,
                    contributors: new Set(),
                    contributions: []
                });
            }
            
            const projectStat = this.projects.get(project);
            projectStat.total++;
            projectStat.contributors.add(username);
            projectStat.contributions.push({
                username,
                ...contrib
            });
        });
    }

    generateReport(startDate, endDate, totalContributions, totalAPICalls) {
        const includeMinor = document.getElementById('includeMinor')?.checked || true;
        const includeBot = document.getElementById('includeBot')?.checked || true;
        
        const report = {
            summary: {
                totalParticipants: this.userStats.size,
                totalProjects: this.projects.size,
                totalContributions: totalContributions,
                totalAPICalls: totalAPICalls,
                period: { start: startDate, end: endDate },
                settings: {
                    projects: this.selectedProjects.map(p => p.name),
                    contributionLimit: this.contributionLimit,
                    includeMinor: includeMinor,
                    includeBot: includeBot
                }
            },
            participants: [],
            projects: [],
            topContributors: [],
            detailedStats: {
                byHour: [],
                byDay: [],
                byProjectType: []
            }
        };
        
        // பங்களிப்பாளர் விவரங்கள்
        this.userStats.forEach((stats, username) => {
            const projectsArray = Array.from(stats.projects.entries())
                .map(([project, count]) => ({ project, count }))
                .sort((a, b) => b.count - a.count);
            
            report.participants.push({
                username,
                total: stats.total,
                minor: stats.minor,
                bot: stats.bot,
                new: stats.new,
                projects: projectsArray,
                projectCount: stats.projects.size,
                contributions: stats.contributions,
                details: {
                    byHour: Array.from(stats.details.byHour.entries())
                        .sort((a, b) => a[0] - b[0])
                        .map(([hour, count]) => ({ hour, count })),
                    byDay: Array.from(stats.details.byDay.entries())
                        .sort((a, b) => a[0].localeCompare(b[0]))
                        .map(([day, count]) => ({ day, count }))
                }
            });
        });
        
        report.participants.sort((a, b) => b.total - a.total);
        
        // திட்ட புள்ளிவிவரங்கள்
        this.projects.forEach((stats, project) => {
            report.projects.push({
                project,
                totalContributions: stats.total,
                uniqueContributors: stats.contributors.size,
                avgPerContributor: stats.total / stats.contributors.size,
                contributions: stats.contributions
            });
        });
        
        report.projects.sort((a, b) => b.totalContributions - a.totalContributions);
        report.topContributors = report.participants.slice(0, 10);
        
        // கால அடிப்படையில் புள்ளிவிவரங்கள்
        const allByHour = new Map();
        const allByDay = new Map();
        
        this.userStats.forEach(stats => {
            stats.details.byHour.forEach((count, hour) => {
                if (!allByHour.has(hour)) allByHour.set(hour, 0);
                allByHour.set(hour, allByHour.get(hour) + count);
            });
            
            stats.details.byDay.forEach((count, day) => {
                if (!allByDay.has(day)) allByDay.set(day, 0);
                allByDay.set(day, allByDay.get(day) + count);
            });
        });
        
        report.detailedStats.byHour = Array.from(allByHour.entries())
            .sort((a, b) => a[0] - b[0])
            .map(([hour, count]) => ({ hour, count }));
        
        report.detailedStats.byDay = Array.from(allByDay.entries())
            .sort((a, b) => a[0].localeCompare(b[0]))
            .map(([day, count]) => ({ day, count }));
        
        return report;
    }

    displayReport(report, containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;
        
        let html = `
            <div class="results-container">
                <div class="results-header">
                    <div>
                        <h2 class="results-title">📊 முழுமையான பங்களிப்பு பகுப்பாய்வு முடிவுகள்</h2>
                        <p style="color: var(--text-light); margin-top: 5px;">
                            ${report.summary.period.start} முதல் ${report.summary.period.end} வரை
                        </p>
                    </div>
                    <div class="results-actions">
                        <button class="export-btn" onclick="exportFullReport()">
                            📄 முழு அறிக்கை
                        </button>
                        <button class="export-btn" onclick="window.print()">
                            🖨️ அச்சிடுக
                        </button>
                    </div>
                </div>
                
                <div class="results-grid">
                    <div class="results-card">
                        <h3>📈 மொத்த புள்ளிவிவரங்கள்</h3>
                        <div style="margin-bottom: 20px;">
                            <div class="stats-value">${report.summary.totalContributions.toLocaleString()}</div>
                            <div class="stats-label">மொத்த பங்களிப்புகள்</div>
                        </div>
                        
                        <div class="detailed-stats">
                            <h4>விரிவான புள்ளிவிவரங்கள்</h4>
                            <div class="stat-row">
                                <span class="stat-category">பங்களிப்பாளர்கள்:</span>
                                <span class="stat-number">${report.summary.totalParticipants}</span>
                            </div>
                            <div class="stat-row">
                                <span class="stat-category">திட்டங்கள்:</span>
                                <span class="stat-number">${report.summary.totalProjects}</span>
                            </div>
                            <div class="stat-row">
                                <span class="stat-category">API அழைப்புகள்:</span>
                                <span class="stat-number">${report.summary.totalAPICalls}</span>
                            </div>
                            <div class="stat-row">
                                <span class="stat-category">சிறு திருத்தங்கள்:</span>
                                <span class="stat-number">${report.participants.reduce((sum, p) => sum + p.minor, 0).toLocaleString()}</span>
                            </div>
                            <div class="stat-row">
                                <span class="stat-category">புதிய பக்கங்கள்:</span>
                                <span class="stat-number">${report.participants.reduce((sum, p) => sum + p.new, 0).toLocaleString()}</span>
                            </div>
                        </div>
                    </div>
                    
                    <div class="results-card">
                        <h3>👥 முன்னணி பங்களிப்பாளர்கள்</h3>
                        <div class="contributor-list">
        `;
        
        report.topContributors.forEach((contributor, index) => {
            const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`;
            const minorPercent = contributor.total > 0 ? Math.round((contributor.minor / contributor.total) * 100) : 0;
            
            html += `
                <div class="contributor-item">
                    <div>
                        <div class="contributor-name">${medal} ${contributor.username}</div>
                        <div class="contributor-details">
                            <div class="detail-item">
                                <div class="detail-label">மொத்தம்</div>
                                <div class="detail-value">${contributor.total.toLocaleString()}</div>
                            </div>
                            <div class="detail-item">
                                <div class="detail-label">சிறு திருத்தங்கள்</div>
                                <div class="detail-value">${contributor.minor.toLocaleString()} (${minorPercent}%)</div>
                            </div>
                            <div class="detail-item">
                                <div class="detail-label">திட்டங்கள்</div>
                                <div class="detail-value">${contributor.projectCount}</div>
                            </div>
                        </div>
                    </div>
                    <div class="contributor-count">${contributor.total.toLocaleString()}</div>
                </div>
            `;
        });
        
        html += `
                        </div>
                    </div>
                    
                    <div class="results-card">
                        <h3>🏗️ திட்டம் வாரியான பங்களிப்புகள்</h3>
                        <div class="project-breakdown">
        `;
        
        report.projects.slice(0, 8).forEach(project => {
            const percentage = (project.totalContributions / report.summary.totalContributions * 100).toFixed(1);
            
            html += `
                <div class="project-item">
                    <span>${project.project}</span>
                    <div style="display: flex; align-items: center; gap: 15px;">
                        <div class="progress-bar">
                            <div class="progress-fill" style="width: ${percentage}%"></div>
                        </div>
                        <span style="font-weight: 600; color: var(--primary); min-width: 80px; text-align: right;">
                            ${project.totalContributions.toLocaleString()}
                        </span>
                    </div>
                </div>
            `;
        });
        
        if (report.projects.length > 8) {
            html += `
                <div style="text-align: center; padding: 10px; color: var(--text-light); font-size: 14px;">
                    + ${report.projects.length - 8} மேலும் திட்டங்கள்
                </div>
            `;
        }
        
        html += `
                        </div>
                    </div>
                    
                    <div class="results-card">
                        <h3>📅 கால அடிப்படையில் பங்களிப்புகள்</h3>
                        <div class="timeline-chart" id="timelineChart">
                            <!-- காலக்கோடு வரைபடம் -->
                        </div>
                        <div style="margin-top: 20px;">
                            <h4>அதிக பங்களிப்பு நேரங்கள்</h4>
                            <div class="detailed-stats">
        `;
        
        // அதிகமான பங்களிப்பு நேரங்கள்
        const topHours = report.detailedStats.byHour
            .sort((a, b) => b.count - a.count)
            .slice(0, 5);
        
        topHours.forEach(hour => {
            const hourLabel = `${hour.hour}:00 - ${hour.hour + 1}:00`;
            html += `
                <div class="stat-row">
                    <span class="stat-category">${hourLabel}</span>
                    <span class="stat-number">${hour.count.toLocaleString()}</span>
                </div>
            `;
        });
        
        html += `
                            </div>
                        </div>
                    </div>
                </div>
                
                <div class="results-card" style="grid-column: 1 / -1;">
                    <h3>📋 முழுமையான பங்களிப்பாளர் பட்டியல்</h3>
                    <div class="contrib-type-filter">
                        <button class="type-filter-btn active" onclick="filterContributors('all')">அனைத்தும்</button>
                        <button class="type-filter-btn" onclick="filterContributors('minor')">சிறு திருத்தங்கள்</button>
                        <button class="type-filter-btn" onclick="filterContributors('new')">புதிய பக்கங்கள்</button>
                        <button class="type-filter-btn" onclick="filterContributors('multiple')">பல திட்டங்கள்</button>
                    </div>
                    <div style="overflow-x: auto;">
                        <table class="data-table">
                            <thead>
                                <tr>
                                    <th>பங்களிப்பாளர்</th>
                                    <th>மொத்த பங்களிப்புகள்</th>
                                    <th>சிறு திருத்தங்கள்</th>
                                    <th>புதிய பக்கங்கள்</th>
                                    <th>திட்டங்கள்</th>
                                    <th>முக்கிய திட்டங்கள்</th>
                                </tr>
                            </thead>
                            <tbody>
        `;
        
        report.participants.forEach(contributor => {
            const topProjects = contributor.projects
                .slice(0, 2)
                .map(p => `<span class="badge badge-primary">${p.project}: ${p.count.toLocaleString()}</span>`)
                .join(' ');
            
            const minorPercent = contributor.total > 0 ? Math.round((contributor.minor / contributor.total) * 100) : 0;
            const newPercent = contributor.total > 0 ? Math.round((contributor.new / contributor.total) * 100) : 0;
            
            html += `
                <tr>
                    <td><strong>${contributor.username}</strong></td>
                    <td><span class="badge badge-success">${contributor.total.toLocaleString()}</span></td>
                    <td>
                        <span class="badge badge-${minorPercent > 50 ? 'warning' : 'info'}">
                            ${contributor.minor.toLocaleString()} (${minorPercent}%)
                        </span>
                    </td>
                    <td>
                        <span class="badge badge-accent">
                            ${contributor.new.toLocaleString()} (${newPercent}%)
                        </span>
                    </td>
                    <td>${contributor.projectCount}</td>
                    <td>${topProjects}</td>
                </tr>
            `;
        });
        
        html += `
                            </tbody>
                        </table>
                    </div>
                </div>
                
                <div class="export-section">
                    <h3>💾 முடிவுகளை ஏற்றுமதி செய்க</h3>
                    <div class="export-buttons">
                        <button class="export-btn" onclick="exportToJSON()">
                            📊 JSON தரவுகள்
                        </button>
                        <button class="export-btn" onclick="exportToCSV()">
                            📈 CSV அறிக்கை
                        </button>
                        <button class="export-btn" onclick="exportToHTML()">
                            📄 HTML அறிக்கை
                        </button>
                        <button class="export-btn" onclick="exportRawData()">
                            🔍 மூல தரவுகள்
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        container.innerHTML = html;
        
        // காலக்கோடு வரைபடத்தை உருவாக்குக
        this.renderTimelineChart(report.detailedStats.byDay);
        
        // முழு அறிக்கையை சேமிக்கவும்
        window.lastFullReport = report;
    }

    renderTimelineChart(byDayData) {
        const chartContainer = document.getElementById('timelineChart');
        if (!chartContainer || byDayData.length === 0) return;
        
        const maxCount = Math.max(...byDayData.map(d => d.count));
        const chartHeight = 150;
        const barWidth = Math.max(20, (chartContainer.clientWidth - 100) / byDayData.length);
        
        chartContainer.innerHTML = '';
        
        byDayData.forEach((dayData, index) => {
            const barHeight = (dayData.count / maxCount) * chartHeight;
            const left = index * (barWidth + 5) + 30;
            
            const bar = document.createElement('div');
            bar.className = 'chart-bar';
            bar.style.left = `${left}px`;
            bar.style.width = `${barWidth}px`;
            bar.style.height = `${barHeight}px`;
            bar.title = `${dayData.day}: ${dayData.count.toLocaleString()} பங்களிப்புகள்`;
            
            const label = document.createElement('div');
            label.className = 'chart-label';
            label.style.left = `${left}px`;
            label.textContent = dayData.day.split('-').slice(1).join('-');
            
            chartContainer.appendChild(bar);
            chartContainer.appendChild(label);
        });
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// ஏற்றுமதி செயல்பாடுகள்
function exportFullReport() {
    if (!window.lastFullReport) {
        showStatus('முதலில் பகுப்பாய்வை இயக்கவும்', 'warning');
        return;
    }
    
    const report = window.lastFullReport;
    const jsonString = JSON.stringify(report, null, 2);
    downloadFile(jsonString, `wikimedia-full-report-${new Date().toISOString().slice(0,10)}.json`, 'application/json');
}

function exportToJSON() {
    if (!window.lastFullReport) {
        showStatus('முதலில் பகுப்பாய்வை இயக்கவும்', 'warning');
        return;
    }
    
    const simplified = {
        summary: window.lastFullReport.summary,
        participants: window.lastFullReport.participants.map(p => ({
            username: p.username,
            total: p.total,
            minor: p.minor,
            new: p.new,
            projectCount: p.projectCount,
            projects: p.projects
        })),
        generated: new Date().toISOString()
    };
    
    const jsonString = JSON.stringify(simplified, null, 2);
    downloadFile(jsonString, 'wikimedia-contributions.json', 'application/json');
}

function exportToCSV() {
    if (!window.lastFullReport) {
        showStatus('முதலில் பகுப்பாய்வை இயக்கவும்', 'warning');
        return;
    }
    
    let csv = 'பங்களிப்பாளர்,மொத்த பங்களிப்புகள்,சிறு திருத்தங்கள்,புதிய பக்கங்கள்,திட்டங்கள்,திட்ட விவரங்கள்\n';
    
    window.lastFullReport.participants.forEach(p => {
        const projectDetails = p.projects
            .map(proj => `${proj.project}:${proj.count}`)
            .join('; ');
        csv += `"${p.username}",${p.total},${p.minor},${p.new},${p.projectCount},"${projectDetails}"\n`;
    });
    
    downloadFile(csv, 'wikimedia-contributions.csv', 'text/csv');
}

function exportToHTML() {
    if (!window.lastFullReport) {
        showStatus('முதலில் பகுப்பாய்வை இயக்கவும்', 'warning');
        return;
    }
    
    const report = window.lastFullReport;
    const html = generateHTMLReport(report);
    downloadFile(html, 'wikimedia-contributions.html', 'text/html');
}

function exportRawData() {
    if (!window.lastFullReport) {
        showStatus('முதலில் பகுப்பாய்வை இயக்கவும்', 'warning');
        return;
    }
    
    const rawData = {
        contributions: [],
        generated: new Date().toISOString()
    };
    
    window.lastFullReport.participants.forEach(p => {
        p.contributions.forEach(c => {
            rawData.contributions.push({
                username: p.username,
                project: c.project,
                title: c.title,
                timestamp: c.timestamp,
                size: c.size,
                minor: c.minor || false,
                new: c.new || false
            });
        });
    });
    
    const jsonString = JSON.stringify(rawData, null, 2);
    downloadFile(jsonString, 'wikimedia-raw-data.json', 'application/json');
}

function generateHTMLReport(report) {
    return `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>விக்கிமீடியா பங்களிப்பு அறிக்கை</title>
            <style>
                body { font-family: Arial, sans-serif; padding: 30px; }
                h1, h2, h3 { color: #1a237e; }
                table { border-collapse: collapse; width: 100%; margin: 20px 0; }
                th, td { border: 1px solid #ddd; padding: 10px; text-align: left; }
                th { background: #1a237e; color: white; }
                .stat { background: #f8f9fa; padding: 20px; margin: 10px; border-radius: 8px; }
                .badge { background: #1a237e; color: white; padding: 3px 8px; border-radius: 4px; font-size: 12px; }
            </style>
        </head>
        <body>
            <h1>விக்கிமீடியா பங்களிப்பு அறிக்கை</h1>
            <p>காலம்: ${report.summary.period.start} முதல் ${report.summary.period.end} வரை</p>
            
            <div style="display: flex; gap: 20px; margin: 30px 0;">
                <div class="stat">
                    <h3>${report.summary.totalContributions.toLocaleString()}</h3>
                    <p>மொத்த பங்களிப்புகள்</p>
                </div>
                <div class="stat">
                    <h3>${report.summary.totalParticipants}</h3>
                    <p>பங்களிப்பாளர்கள்</p>
                </div>
                <div class="stat">
                    <h3>${report.summary.totalProjects}</h3>
                    <p>திட்டங்கள்</p>
                </div>
            </div>
            
            <h2>பங்களிப்பாளர்கள்</h2>
            <table>
                <tr>
                    <th>பங்களிப்பாளர்</th>
                    <th>மொத்தம்</th>
                    <th>சிறு திருத்தங்கள்</th>
                    <th>புதிய பக்கங்கள்</th>
                    <th>திட்டங்கள்</th>
                </tr>
                ${report.participants.map(p => `
                    <tr>
                        <td>${p.username}</td>
                        <td><span class="badge">${p.total.toLocaleString()}</span></td>
                        <td>${p.minor.toLocaleString()}</td>
                        <td>${p.new.toLocaleString()}</td>
                        <td>${p.projectCount}</td>
                    </tr>
                `).join('')}
            </table>
            
            <h2>திட்டங்கள்</h2>
            <table>
                <tr>
                    <th>திட்டம்</th>
                    <th>மொத்த பங்களிப்புகள்</th>
                    <th>தனிப்பட்ட பங்களிப்பாளர்கள்</th>
                </tr>
                ${report.projects.map(p => `
                    <tr>
                        <td>${p.project}</td>
                        <td>${p.totalContributions.toLocaleString()}</td>
                        <td>${p.uniqueContributors}</td>
                    </tr>
                `).join('')}
            </table>
            
            <p style="margin-top: 50px; color: #666; font-size: 12px;">
                உருவாக்கப்பட்டது: ${new Date().toLocaleString('ta-IN')} | 
                API அழைப்புகள்: ${report.summary.totalAPICalls}
            </p>
        </body>
        </html>
    `;
}

function downloadFile(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    showStatus(`${filename} பதிவிறக்கம் செய்யப்பட்டது`, 'success');
}

// பங்களிப்பாளர் வடிகட்டுதல்
function filterContributors(type) {
    const buttons = document.querySelectorAll('.type-filter-btn');
    buttons.forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');
    
    showStatus(`${type} வடிகட்டல் பயன்படுத்தப்படுகிறது`, 'info');
}

// பகுப்பாய்வு பொத்தான் கிளிக் செயல்பாடு
document.addEventListener('DOMContentLoaded', function() {
    const analyzeBtn = document.getElementById('analyzeBtn');
    if (analyzeBtn) {
        analyzeBtn.addEventListener('click', async function() {
            const participants = Array.from(window.participants || new Set());
            const startDate = document.getElementById('startDate')?.value;
            const endDate = document.getElementById('endDate')?.value;
            
            if (participants.length === 0) {
                showStatus('முதலில் பங்களிப்பாளர்களைச் சேர்க்கவும்', 'warning');
                return;
            }
            
            if (!startDate || !endDate) {
                showStatus('தேதி வரம்பைத் தேர்ந்தெடுக்கவும்', 'warning');
                return;
            }
            
            try {
                analyzeBtn.disabled = true;
                analyzeBtn.innerHTML = '<span>⏳ முழுமையான பகுப்பாய்வு...</span>';
                
                const analyzer = new CompleteContributionsAnalyzer();
                const report = await analyzer.analyzeEvent(participants, startDate, endDate);
                
                analyzer.displayReport(report, 'results');
                
                analyzeBtn.disabled = false;
                analyzeBtn.innerHTML = '<span>🔍 முழுமையான பகுப்பாய்வு</span>';
                
            } catch (error) {
                console.error('பகுப்பாய்வு பிழை:', error);
                showStatus(`பகுப்பாய்வு பிழை: ${error.message}`, 'error');
                analyzeBtn.disabled = false;
                analyzeBtn.innerHTML = '<span>🔍 முழுமையான பகுப்பாய்வு</span>';
            }
        });
    }
});
