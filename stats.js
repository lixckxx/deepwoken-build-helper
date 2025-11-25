document.addEventListener('DOMContentLoaded', () => {
    // Tab Navigation
    const tabButtons = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const tabName = button.getAttribute('data-tab');

            // Remove active class from all buttons and contents
            tabButtons.forEach(btn => btn.classList.remove('active'));
            tabContents.forEach(content => content.classList.remove('active'));

            // Add active class to clicked button and corresponding content
            button.classList.add('active');
            document.getElementById(`${tabName}-tab`).classList.add('active');
        });
    });

    // Global Constant for the point limit
    const MAX_TOTAL_POINTS = 330;

    // ==========================================
    // STATS TAB (Manual Build & Shrine)
    // ==========================================

    const shrineButton = document.getElementById('shrineButton');
    const shrineResultsModal = document.getElementById('shrineResultsModal');
    const closeShrineModal = document.getElementById('closeShrineModal');

    // Function to sync stats to Point Optimizer
    function syncToOptimizer(statName, preValue, postValue) {
        // Find the corresponding stat row in the optimizer tab
        const optimizerRow = document.querySelector(`#optimizer-tab .stat-row[data-stat="${statName}"]`);
        if (!optimizerRow) return;

        // Get the first input group
        const firstInputGroup = optimizerRow.querySelector('.input-group');
        const firstInput = firstInputGroup.querySelector('input[type="number"]');
        const firstSelect = firstInputGroup.querySelector('.condition-select');

        // Only update if condition is set to "any"
        if (firstSelect.value === 'any') {
            const maxValue = Math.max(preValue, postValue);
            firstInput.value = maxValue;
        }
    }

    // Setup input validation for simple inputs
    const setupSimpleInputValidation = (input) => {
        const statRow = input.closest('.stat-row.simple');
        const statName = statRow.getAttribute('data-stat');

        input.addEventListener('blur', () => {
            let value = parseInt(input.value) || 0;
            value = Math.max(0, Math.min(100, value));
            input.value = value;
            // updateTotalPoints();

            // Sync to optimizer
            const dualGroup = input.closest('.dual-input-group');
            const preInput = dualGroup.querySelector('.pre-shrine');
            const postInput = dualGroup.querySelector('.post-shrine');
            syncToOptimizer(statName, parseInt(preInput.value) || 0, parseInt(postInput.value) || 0);
        });

        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                let value = parseInt(input.value) || 0;
                value = Math.max(0, Math.min(100, value));
                input.value = value;
                // updateTotalPoints();

                // Sync to optimizer
                const dualGroup = input.closest('.dual-input-group');
                const preInput = dualGroup.querySelector('.pre-shrine');
                const postInput = dualGroup.querySelector('.post-shrine');
                syncToOptimizer(statName, parseInt(preInput.value) || 0, parseInt(postInput.value) || 0);

                input.blur();
            }
        });

        input.addEventListener('keypress', (e) => {
            if (!/[0-9]/.test(e.key) &&
                e.key !== 'Backspace' &&
                e.key !== 'Delete' &&
                e.key !== 'ArrowLeft' &&
                e.key !== 'ArrowRight' &&
                e.key !== 'Tab') {
                e.preventDefault();
            }
        });

        // input.addEventListener('input', updateTotalPoints);
    };

    // Apply validation to all simple inputs in stats tab
    document.querySelectorAll('#stats-tab .simple-input').forEach(input => {
        setupSimpleInputValidation(input);
    });

    function collectManualBuildStats() {
        const stats = { pre: {}, post: {} };

        document.querySelectorAll('#stats-tab .stat-row.simple').forEach(row => {
            const statName = row.getAttribute('data-stat');
            const preInput = row.querySelector('.pre-shrine');
            const postInput = row.querySelector('.post-shrine');

            const preValue = parseInt(preInput.value) || 0;
            const postValue = parseInt(postInput.value) || 0;

            if (preValue > 0) {
                stats.pre[statName] = preValue;
            }
            if (postValue > 0) {
                stats.post[statName] = postValue;
            }
        });

        return stats;
    }

    function simulateShrineAveraging(stats) {
        const BOTTLENECK_LIMIT = 25;
        const MAX_STAT = 100;
        const attunements = ['Flamecharm', 'Frostdraw', 'Thundercall', 'Galebreathe', 'Shadowcast', 'Ironsing', 'Bloodrend'];

        // Calculate total invested and affected stats
        let totalInvested = 0;
        const affectedStats = [];

        for (const [statName, value] of Object.entries(stats)) {
            if (value > 0) {
                totalInvested += value;
                affectedStats.push(statName);
            }
        }

        if (affectedStats.length === 0) {
            return { totalInvested: 0, postShrine: {}, leftoverPoints: 0 };
        }

        const pointsStart = totalInvested;
        const preshrineBuild = { ...stats };
        const postShrine = {};

        // Initialize with average
        for (const statName of affectedStats) {
            postShrine[statName] = pointsStart / affectedStats.length;
        }

        // Bottlenecking process
        let bottleneckedDivideBy = affectedStats.filter(s => !attunements.includes(s)).length;
        const bottlenecked = [];
        let bottleneckedStats = false;
        let previousStats = { ...postShrine };

        do {
            let bottleneckedPoints = 0;
            bottleneckedStats = false;

            // Check for bottlenecking in non-attunement stats only
            for (const statName of affectedStats) {
                const isAttunement = attunements.includes(statName);

                if (!isAttunement && !bottlenecked.includes(statName)) {
                    const prevStat = previousStats[statName];
                    const shrineStat = preshrineBuild[statName];
                    const currentStat = postShrine[statName];

                    if (shrineStat - currentStat > BOTTLENECK_LIMIT) {
                        postShrine[statName] = shrineStat - BOTTLENECK_LIMIT;
                        bottleneckedPoints += postShrine[statName] - prevStat;
                        bottlenecked.push(statName);
                        bottleneckedDivideBy--;
                    }
                }
            }

            // Redistribute bottlenecked points ONLY to non-bottlenecked NON-ATTUNEMENT stats
            if (bottleneckedDivideBy > 0 && bottleneckedPoints !== 0) {
                for (const statName of affectedStats) {
                    const isAttunement = attunements.includes(statName);

                    if (!isAttunement && !bottlenecked.includes(statName)) {
                        postShrine[statName] -= bottleneckedPoints / bottleneckedDivideBy;

                        if (preshrineBuild[statName] - postShrine[statName] > BOTTLENECK_LIMIT) {
                            bottleneckedStats = true;
                        }
                    }
                }
            }

            previousStats = { ...postShrine };
        } while (bottleneckedStats);

        // Floor all stats
        for (const statName in postShrine) {
            postShrine[statName] = Math.floor(postShrine[statName]);
        }

        // Calculate spare points
        let sparePoints = pointsStart - Object.values(postShrine).reduce((a, b) => a + b, 0);

        // Distribute spare points (repeatedly, 1 point at a time)
        while (sparePoints > 0) {
            let changed = false;

            for (const statName of affectedStats) {
                if (sparePoints <= 0) break;
                if (bottlenecked.includes(statName)) continue;
                if (postShrine[statName] >= MAX_STAT) continue;

                postShrine[statName] += 1;
                sparePoints -= 1;
                changed = true;
            }

            if (!changed) break;
        }

        return {
            totalInvested: pointsStart,
            postShrine,
            leftoverPoints: sparePoints
        };
    }



    // ==========================================
    // BUILD OPTIMIZER TAB
    // ==========================================

    const calculateButton = document.getElementById('calculateButton');
    const addButtons = document.querySelectorAll('#optimizer-tab .add-input-btn');

    const handleInputValidation = (input) => {
        let value = parseInt(input.value) || 0;
        value = Math.max(0, Math.min(100, value));
        input.value = value;
    };

    const setupInputValidation = (input) => {
        input.addEventListener('blur', () => {
            handleInputValidation(input);
        });

        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                handleInputValidation(input);
                input.blur();
            }
        });

        input.addEventListener('keypress', (e) => {
            if (!/[0-9]/.test(e.key) &&
                e.key !== 'Backspace' &&
                e.key !== 'Delete' &&
                e.key !== 'ArrowLeft' &&
                e.key !== 'ArrowRight' &&
                e.key !== 'Tab') {
                e.preventDefault();
            }
        });
    };

    // Apply validation to all existing optimizer inputs
    document.querySelectorAll('#optimizer-tab input[type="number"]').forEach(input => {
        setupInputValidation(input);
    });

    const handleConditionChange = (event) => {
        const select = event.target;
        const inputElement = select.previousElementSibling;
        if (inputElement && inputElement.tagName === 'INPUT') {
            inputElement.setAttribute('data-condition', select.value);
        }
    };

    document.querySelectorAll('#optimizer-tab .condition-select').forEach(select => {
        select.addEventListener('change', handleConditionChange);
    });

    addButtons.forEach(button => {
        button.addEventListener('click', () => {
            const statRow = button.closest('.stat-row');
            const inputGroup = statRow.querySelector('.input-group');
            const currentInputs = inputGroup.querySelectorAll('input[type="number"]').length;

            if (currentInputs < 2) {
                const newInput = document.createElement('input');
                newInput.type = 'number';
                newInput.value = '0';
                newInput.classList.add('dynamic-input');
                newInput.setAttribute('data-condition', 'any');
                setupInputValidation(newInput);

                const newSelect = document.createElement('select');
                newSelect.classList.add('condition-select');
                newSelect.innerHTML = `
                    <option value="any">Any</option>
                    <option value="pre">Pre-Shrine</option>
                    <option value="post">Post-Shrine</option>
                `;
                newSelect.addEventListener('change', handleConditionChange);

                const removeButton = document.createElement('button');
                removeButton.textContent = '-';
                removeButton.classList.add('remove-input-btn');

                inputGroup.appendChild(newInput);
                inputGroup.appendChild(newSelect);
                inputGroup.appendChild(removeButton);

                removeButton.addEventListener('click', () => {
                    newInput.remove();
                    newSelect.remove();
                    removeButton.remove();
                    button.style.display = '';
                });
            }

            const totalInputs = inputGroup.querySelectorAll('input[type="number"]').length;
            if (totalInputs >= 2) {
                button.style.display = 'none';
            }
        });
    });

    // --- Calculation Logic ---

    function collectDesiredStats() {
        const desiredStats = {};

        document.querySelectorAll('#optimizer-tab .stat-row[data-stat]').forEach(statRow => {
            const statName = statRow.getAttribute('data-stat');
            desiredStats[statName] = [];

            statRow.querySelectorAll('.input-group input[type="number"]').forEach(input => {
                const value = parseInt(input.value) || 0;
                const condition = input.getAttribute('data-condition') || 'any';

                if (value > 0) {
                    desiredStats[statName].push({ value: value, condition: condition });
                }
            });
        });
        return desiredStats;
    }

    function calculateOptimalOrder(desiredStats) {
        const MAX_TOTAL_POINTS = 330;
        const MAX_STAT_VALUE = 100;
        const BOTTLENECK_LIMIT = 25;

        // Identify attunement stats
        const attunementStats = ['Flamecharm', 'Frostdraw', 'Thundercall', 'Galebreathe', 'Shadowcast', 'Ironsing', 'Bloodrend'];

        // Parse requirements for each stat
        const statRequirements = {};
        for (const [statName, requirements] of Object.entries(desiredStats)) {
            if (requirements.length === 0) continue;

            statRequirements[statName] = {
                isAttunement: attunementStats.includes(statName),
                requirements: requirements,
                minPre: 0,
                minPost: 0,
                hasAny: false
            };

            // Determine minimum pre/post requirements
            for (const req of requirements) {
                if (req.condition === 'pre') {
                    statRequirements[statName].minPre = Math.max(statRequirements[statName].minPre, req.value);
                } else if (req.condition === 'post') {
                    statRequirements[statName].minPost = Math.max(statRequirements[statName].minPost, req.value);
                } else if (req.condition === 'any') {
                    statRequirements[statName].hasAny = true;
                }
            }
        }

        // Generate all possible combinations for 'any' conditions
        function generateCombinations(statReqs) {
            const statsWithAny = [];
            const baseConfig = {};

            for (const [statName, data] of Object.entries(statReqs)) {
                baseConfig[statName] = {
                    isAttunement: data.isAttunement,
                    minPre: data.minPre,
                    minPost: data.minPost,
                    anyRequirements: []
                };

                if (data.hasAny) {
                    const anyReqs = data.requirements.filter(r => r.condition === 'any');
                    baseConfig[statName].anyRequirements = anyReqs;
                    statsWithAny.push(statName);
                }
            }

            // Generate all combinations of pre/post for 'any' requirements
            const combinations = [];
            const totalAnyRequirements = statsWithAny.reduce((sum, statName) =>
                sum + baseConfig[statName].anyRequirements.length, 0);

            const totalCombinations = Math.pow(2, totalAnyRequirements);

            for (let i = 0; i < totalCombinations; i++) {
                const config = JSON.parse(JSON.stringify(baseConfig));
                let bitIndex = 0;

                for (const statName of statsWithAny) {
                    for (const anyReq of config[statName].anyRequirements) {
                        const isPre = (i >> bitIndex) & 1;
                        bitIndex++;

                        if (isPre) {
                            config[statName].minPre = Math.max(config[statName].minPre, anyReq.value);
                        } else {
                            config[statName].minPost = Math.max(config[statName].minPost, anyReq.value);
                        }
                    }
                }

                combinations.push(config);
            }

            return combinations.length > 0 ? combinations : [baseConfig];
        }

        const allCombinations = generateCombinations(statRequirements);

        // Generate shrine inclusion variants for post-only stats
        const allCombinationsWithShrineOptions = [];
        for (const config of allCombinations) {
            const postOnlyStats = [];
            for (const [statName, data] of Object.entries(config)) {
                if (data.minPost > 0 && data.minPre === 0) {
                    postOnlyStats.push(statName);
                }
            }

            // Generate all combinations of including/excluding post-only stats from shrine
            const shrineOptionCount = Math.pow(2, postOnlyStats.length);
            for (let i = 0; i < shrineOptionCount; i++) {
                const variant = {
                    config: config,
                    shrineInclusions: {}
                };

                for (let j = 0; j < postOnlyStats.length; j++) {
                    const includeInShrine = (i >> j) & 1;
                    variant.shrineInclusions[postOnlyStats[j]] = includeInShrine === 1;
                }

                allCombinationsWithShrineOptions.push(variant);
            }

            // If no post-only stats, just add the config as-is
            if (postOnlyStats.length === 0) {
                allCombinationsWithShrineOptions.push({
                    config: config,
                    shrineInclusions: {}
                });
            }
        }

        console.log(`Testing ${allCombinationsWithShrineOptions.length} combinations (including shrine inclusion variants)...`);

        let bestSolution = null;
        let bestScore = -Infinity;

        for (const variant of allCombinationsWithShrineOptions) {
            const config = variant.config;

            // Build pre-shrine allocation
            const preShrine = {};
            const statsToInclude = new Set();

            for (const [statName, data] of Object.entries(config)) {
                if (data.minPre > 0) {
                    preShrine[statName] = {
                        currentPre: data.minPre,
                        isAttunement: data.isAttunement
                    };
                    statsToInclude.add(statName);
                }

                // Check if this post-only stat should be included in shrine
                if (data.minPost > 0 && data.minPre === 0) {
                    if (variant.shrineInclusions[statName]) {
                        // Include in shrine with 1 point investment
                        preShrine[statName] = {
                            currentPre: 1,
                            isAttunement: data.isAttunement
                        };
                        statsToInclude.add(statName);
                    }
                }
            }

            // Calculate total pre-shrine investment
            let totalPreInvestment = 0;
            for (const data of Object.values(preShrine)) {
                totalPreInvestment += data.currentPre;
            }

            if (totalPreInvestment > MAX_TOTAL_POINTS) continue;

            // Simulate shrine averaging
            const shrineResult = simulateShrineAveragingOptimizer(preShrine);

            // Check if post-shrine values meet requirements
            let isValid = true;
            let totalPostInvestment = 0;
            const finalStats = {};

            for (const [statName, data] of Object.entries(config)) {
                const postShrineValue = shrineResult.postShrine[statName] || 0;

                // For stats excluded from shrine, invest all points post-shrine
                if (data.minPost > 0 && data.minPre === 0 && !variant.shrineInclusions[statName]) {
                    finalStats[statName] = data.minPost;
                    totalPostInvestment += data.minPost;
                } else {
                    // For stats in shrine or with pre-shrine requirements
                    const neededPost = Math.max(0, data.minPost - postShrineValue);
                    finalStats[statName] = postShrineValue + neededPost;
                    totalPostInvestment += neededPost;
                }

                // Check validity
                if (finalStats[statName] > MAX_STAT_VALUE) {
                    isValid = false;
                    break;
                }

                // Verify pre-shrine requirement
                if (preShrine[statName] && preShrine[statName].currentPre < data.minPre) {
                    isValid = false;
                    break;
                }
            }

            const totalPoints = totalPostInvestment + totalPreInvestment;
            if (!isValid || totalPoints > MAX_TOTAL_POINTS) continue;

            // Calculate score (prefer more leftover points)
            const leftoverPoints = MAX_TOTAL_POINTS - totalPoints;
            const score = leftoverPoints;

            if (score > bestScore) {
                bestScore = score;
                bestSolution = {
                    preShrine: preShrine,
                    postShrine: shrineResult.postShrine,
                    finalStats: finalStats,
                    totalPreInvestment: totalPreInvestment,
                    totalPostInvestment: totalPostInvestment,
                    leftoverPoints: leftoverPoints,
                    shrineLeftover: shrineResult.leftoverPoints
                };
            }
        }

        if (bestSolution) {
            console.log('--- Optimal Solution Found ---');
            console.log('Pre-Shrine Investment:', bestSolution.totalPreInvestment);
            console.table(Object.entries(bestSolution.preShrine).map(([stat, data]) => ({
                Stat: stat,
                Points: data.currentPre
            })));

            console.log('\nPost-Shrine Values (after averaging):');
            console.table(bestSolution.postShrine);
            console.log(bestSolution.shrineLeftover)

            console.log('\nFinal Stats:');
            console.table(bestSolution.finalStats);

            console.log(`\nTotal Points Used: ${bestSolution.totalPreInvestment + bestSolution.totalPostInvestment}`);
            console.log(`Leftover Points: ${bestSolution.leftoverPoints}`);
            console.log(`Shrine Leftover: ${bestSolution.shrineLeftover}`);
        } else {
            console.log('No valid solution found within constraints.');
        }

        return bestSolution;
    }

    function simulateShrineAveragingOptimizer(stats) {
        const BOTTLENECK_LIMIT = 25;
        const MAX_STAT = 100;
        const attunements = ['Flamecharm', 'Frostdraw', 'Thundercall', 'Galebreathe', 'Shadowcast', 'Ironsing', 'Bloodrend'];

        // Calculate total invested and affected stats
        let totalInvested = 0;
        const affectedStats = [];

        for (const [statName, statData] of Object.entries(stats)) {
            if (statData.currentPre > 0) {
                totalInvested += statData.currentPre;
                affectedStats.push(statName);
            }
        }

        if (affectedStats.length === 0) {
            return { totalInvested: 0, postShrine: {}, leftoverPoints: 0 };
        }

        const pointsStart = totalInvested;
        const preshrineBuild = {};
        const postShrine = {};

        // Initialize with average
        for (const statName of affectedStats) {
            preshrineBuild[statName] = stats[statName].currentPre;
            postShrine[statName] = pointsStart / affectedStats.length;
        }

        // Bottlenecking process
        let bottleneckedDivideBy = affectedStats.filter(s => !attunements.includes(s)).length;
        const bottlenecked = [];
        let bottleneckedStats = false;
        let previousStats = { ...postShrine };

        do {
            let bottleneckedPoints = 0;
            bottleneckedStats = false;

            // Check for bottlenecking in non-attunement stats only
            for (const statName of affectedStats) {
                const isAttunement = attunements.includes(statName);

                if (!isAttunement && !bottlenecked.includes(statName)) {
                    const prevStat = previousStats[statName];
                    const shrineStat = preshrineBuild[statName];
                    const currentStat = postShrine[statName];

                    if (shrineStat - currentStat > BOTTLENECK_LIMIT) {
                        postShrine[statName] = shrineStat - BOTTLENECK_LIMIT;
                        bottleneckedPoints += postShrine[statName] - prevStat;
                        bottlenecked.push(statName);
                        bottleneckedDivideBy--;
                    }
                }
            }

            // Redistribute bottlenecked points ONLY to non-bottlenecked NON-ATTUNEMENT stats
            if (bottleneckedDivideBy > 0 && bottleneckedPoints !== 0) {
                for (const statName of affectedStats) {
                    const isAttunement = attunements.includes(statName);

                    if (!isAttunement && !bottlenecked.includes(statName)) {
                        postShrine[statName] -= bottleneckedPoints / bottleneckedDivideBy;

                        if (preshrineBuild[statName] - postShrine[statName] > BOTTLENECK_LIMIT) {
                            bottleneckedStats = true;
                        }
                    }
                }
            }

            previousStats = { ...postShrine };
        } while (bottleneckedStats);

        // Floor all stats
        for (const statName in postShrine) {
            postShrine[statName] = Math.floor(postShrine[statName]);
        }

        // Calculate spare points
        let sparePoints = pointsStart - Object.values(postShrine).reduce((a, b) => a + b, 0);

        // Distribute spare points (repeatedly, 1 point at a time)
        while (sparePoints > 0) {
            let changed = false;

            for (const statName of affectedStats) {
                if (sparePoints <= 0) break;
                if (bottlenecked.includes(statName)) continue;
                if (postShrine[statName] >= MAX_STAT) continue;

                postShrine[statName] += 1;
                sparePoints -= 1;
                changed = true;
            }

            if (!changed) break;
        }

        return {
            totalInvested: pointsStart,
            postShrine,
            leftoverPoints: sparePoints
        };
    }

    function handleCalculateClick() {
        const desiredStats = collectDesiredStats();

        console.log('--- User Desired Requirements ---');
        console.table(desiredStats);

        const solution = calculateOptimalOrder(desiredStats);

        if (solution) {
            displayResults(solution);
        } else {
            alert('No valid solution found within constraints. Please adjust your requirements.');
        }
    }

    function displayResults(solution) {
        window.currentSolution = solution;

        const modal = document.getElementById('resultsModal');

        // Populate summary
        document.getElementById('totalPointsUsed').textContent =
            solution.totalPreInvestment + solution.totalPostInvestment;
        document.getElementById('leftoverPoints').textContent = solution.leftoverPoints;
        document.getElementById('preInvestment').textContent = solution.totalPreInvestment;
        document.getElementById('postInvestment').textContent = solution.totalPostInvestment;

        // Populate pre-shrine build
        const preShrineBuild = document.getElementById('preShrineBuild');
        preShrineBuild.innerHTML = '';
        for (const [stat, data] of Object.entries(solution.preShrine)) {
            const statItem = document.createElement('div');
            statItem.className = 'stat-item';
            statItem.innerHTML = `
                <span class="stat-name">${stat}</span>
                <span class="stat-value">${data.currentPre}</span>
            `;
            preShrineBuild.appendChild(statItem);
        }

        const combinedStats = document.getElementById('combinedStats');
        combinedStats.innerHTML = '';

        // Show all final stats
        for (const [stat, finalValue] of Object.entries(solution.finalStats)) {
            if (finalValue === 0) continue;

            const statItem = document.createElement('div');
            statItem.className = 'stat-item';

            // Check if this stat went through shrine averaging
            if (solution.postShrine[stat] !== undefined) {
                const postValue = solution.postShrine[stat];
                const additionalInvestment = finalValue - postValue;

                if (additionalInvestment > 0) {
                    statItem.innerHTML = `
                        <span class="stat-name">${stat}</span>
                        <span class="stat-value">${postValue} → ${finalValue} <span style="font-size: 0.85em; color: var(--card-text-secondary);">(+${additionalInvestment})</span></span>
                    `;
                } else {
                    statItem.innerHTML = `
                        <span class="stat-name">${stat}</span>
                        <span class="stat-value">${finalValue}</span>
                    `;
                }
            } else {
                // Stat was excluded from shrine (invested fully post-shrine)
                statItem.innerHTML = `
                    <span class="stat-name">${stat}</span>
                    <span class="stat-value">0 → ${finalValue} <span style="font-size: 0.85em; color: var(--card-text-secondary);">(+${finalValue})</span></span>
                `;
            }

            combinedStats.appendChild(statItem);
        }

        // Show modal
        modal.classList.add('active');
    }

    function applyToBuilder(solution) {
        // Clear all inputs first
        document.querySelectorAll('#stats-tab .stat-row.simple').forEach(row => {
            const preInput = row.querySelector('.pre-shrine');
            const postInput = row.querySelector('.post-shrine');
            preInput.value = 0;
            postInput.value = 0;
        });

        // Apply pre-shrine values
        for (const [statName, data] of Object.entries(solution.preShrine)) {
            const statRow = document.querySelector(`#stats-tab .stat-row.simple[data-stat="${statName}"]`);
            if (statRow) {
                const preInput = statRow.querySelector('.pre-shrine');
                preInput.value = data.currentPre;
            }
        }

        // Apply final values as post-shrine
        for (const [statName, finalValue] of Object.entries(solution.finalStats)) {
            const statRow = document.querySelector(`#stats-tab .stat-row.simple[data-stat="${statName}"]`);
            if (statRow) {
                const postInput = statRow.querySelector('.post-shrine');

                // If stat was in shrine, post value is final value
                // If stat was excluded from shrine, post value is final value
                postInput.value = finalValue;
            }
        }

        // Switch to Build tab
        const buildTab = document.querySelector('.tab-btn[data-tab="stats"]');
        const statsTabContent = document.getElementById('stats-tab');

        document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));

        buildTab.classList.add('active');
        statsTabContent.classList.add('active');

        // Close modal
        document.getElementById('resultsModal').classList.remove('active');

        // Show success message
       alert('Build applied successfully!');
    }

    // Attach event listener to Apply to Builder button
    document.getElementById('applyToBuilderBtn').addEventListener('click', () => {
        console.log(window.currentSolution)
        if (window.currentSolution) {
            console.log("solution")
            applyToBuilder(window.currentSolution);
        }
    });

    // Close modal functionality
    const modal = document.getElementById('resultsModal');
    const closeBtn = modal.querySelector('.close-btn');

    closeBtn.addEventListener('click', () => {
        modal.classList.remove('active');
    });

    // Close modal when clicking outside
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.classList.remove('active');
        }
    });

    // --- Attach Calculate Listener ---
    calculateButton.addEventListener('click', handleCalculateClick);

    // ==========================================
    // TALENTS TAB
    // ==========================================

    let allTalents = [];
    let selectedTalents = new Set();
    let availableFilters = new Set();
    let selectedFilters = new Set();

    // Fetch talents data
    async function loadTalents() {
        try {
            const response = await fetch('proxy.json');
            const data = await response.json();

            // List of talent IDs to hide
            const hiddenTalents = ['thank you'];

            // Convert object to array and filter out invalid entries and hidden talents
            allTalents = Object.entries(data)
                .filter(([key, talent]) => talent && talent.name && !hiddenTalents.includes(key.toLowerCase()))
                .map(([key, talent]) => ({
                    id: key,
                    ...talent
                }));

            console.log(`Loaded ${allTalents.length} talents`);
            renderAvailableTalents();
        } catch (error) {
            console.error('Error loading talents:', error);
            document.getElementById('availableTalents').innerHTML =
                '<p class="empty-message">Error loading talents. Please check console.</p>';
        }
    }

    function getTalentRequirements(talent) {
        const reqs = [];

        if (talent.reqs) {
            // Base stats
            if (talent.reqs.base) {
                for (const [stat, value] of Object.entries(talent.reqs.base)) {
                    if (value > 0 && stat !== 'Body' && stat !== 'Mind') {
                        reqs.push({ stat, value });
                    }
                }
            }

            // Weapon stats
            if (talent.reqs.weapon) {
                for (const [stat, value] of Object.entries(talent.reqs.weapon)) {
                    if (value > 0) {
                        reqs.push({ stat, value });
                    }
                }
            }

            // Attunement stats
            if (talent.reqs.attunement) {
                for (const [stat, value] of Object.entries(talent.reqs.attunement)) {
                    if (value > 0) {
                        reqs.push({ stat, value });
                    }
                }
            }
        }

        return reqs;
    }

    function createTalentCard(talent, isSelected = false) {
        const card = document.createElement('div');
        card.className = 'talent-card';
        card.dataset.talentId = talent.id;

        const requirements = getTalentRequirements(talent);

        let reqsHTML = '';
        if (requirements.length > 0) {
            reqsHTML = '<div class="talent-requirements">';
            requirements.forEach(req => {
                reqsHTML += `<span class="req-badge">${req.stat}: ${req.value}</span>`;
            });
            reqsHTML += '</div>';
        }

        card.innerHTML = `
            <div class="talent-header">
                <span class="talent-name">${talent.name}</span>
                <span class="talent-rarity">${talent.rarity || 'Common'}</span>
            </div>
            <div class="talent-desc">${talent.desc || 'No description available'}</div>
            ${reqsHTML}
        `;

        card.addEventListener('click', () => {
            if (isSelected) {
                unselectTalent(talent.id);
            } else {
                selectTalent(talent.id);
            }
        });

        return card;
    }

    function selectTalent(talentId) {
        selectedTalents.add(talentId);
        renderBothPanels();
    }

    function unselectTalent(talentId) {
        selectedTalents.delete(talentId);
        renderBothPanels();
    }

    function matchesFilters(talent, activeFilters) {
        if (activeFilters.size === 0) return true;

        const requirements = getTalentRequirements(talent);
        const talentStats = new Set(requirements.map(req => req.stat));

        // Talent must have ALL of the active filters (AND logic)
        for (const filter of activeFilters) {
            if (!talentStats.has(filter)) {
                return false;
            }
        }

        return true;
    }

    function matchesSearch(talent, searchTerm) {
        if (!searchTerm) return true;

        const term = searchTerm.toLowerCase();
        return (
            talent.name.toLowerCase().includes(term) ||
            (talent.desc && talent.desc.toLowerCase().includes(term)) ||
            (talent.category && talent.category.toLowerCase().includes(term))
        );
    }

    function renderAvailableTalents() {
        const container = document.getElementById('availableTalents');
        const searchTerm = document.getElementById('searchAvailable').value;

        // Filter out selected talents
        const available = allTalents.filter(t => !selectedTalents.has(t.id));

        if (available.length === 0) {
            container.innerHTML = '<p class="empty-message">All talents selected</p>';
            return;
        }

        container.innerHTML = '';

        let visibleCount = 0;
        available.forEach(talent => {
            const card = createTalentCard(talent, false);

            const matchesFilter = matchesFilters(talent, availableFilters);
            const matchesSearchTerm = matchesSearch(talent, searchTerm);

            if (!matchesFilter || !matchesSearchTerm) {
                card.classList.add('hidden');
            } else {
                visibleCount++;
            }

            container.appendChild(card);
        });

        if (visibleCount === 0) {
            container.innerHTML = '<p class="empty-message">No talents match your filters</p>';
        }
    }

    function renderSelectedTalents() {
        const container = document.getElementById('selectedTalents');
        const searchTerm = document.getElementById('searchSelected').value;

        const selected = allTalents.filter(t => selectedTalents.has(t.id));

        if (selected.length === 0) {
            container.innerHTML = '<p class="empty-message">No talents selected</p>';
            return;
        }

        container.innerHTML = '';

        let visibleCount = 0;
        selected.forEach(talent => {
            const card = createTalentCard(talent, true);

            const matchesFilter = matchesFilters(talent, selectedFilters);
            const matchesSearchTerm = matchesSearch(talent, searchTerm);

            if (!matchesFilter || !matchesSearchTerm) {
                card.classList.add('hidden');
            } else {
                visibleCount++;
            }

            container.appendChild(card);
        });

        if (visibleCount === 0) {
            container.innerHTML = '<p class="empty-message">No selected talents match your filters</p>';
        }
    }

    function renderBothPanels() {
        renderAvailableTalents();
        renderSelectedTalents();
    }

    // Setup filter buttons
    function setupFilterButtons(containerId, filterSet) {
        const container = document.getElementById(containerId);
        const filterButtons = container.querySelectorAll('.filter-btn:not(.clear-filters)');
        const clearButton = container.querySelector('.clear-filters');

        filterButtons.forEach(button => {
            button.addEventListener('click', () => {
                const filter = button.getAttribute('data-filter');

                if (filterSet.has(filter)) {
                    filterSet.delete(filter);
                    button.classList.remove('active');
                } else {
                    filterSet.add(filter);
                    button.classList.add('active');
                }

                renderBothPanels();
            });
        });

        clearButton.addEventListener('click', () => {
            filterSet.clear();
            filterButtons.forEach(btn => btn.classList.remove('active'));
            renderBothPanels();
        });
    }

    // Setup search bars
    document.getElementById('searchAvailable').addEventListener('input', () => {
        renderAvailableTalents();
    });

    document.getElementById('searchSelected').addEventListener('input', () => {
        renderSelectedTalents();
    });

    // Initialize talents tab
    setupFilterButtons('availableFilters', availableFilters);
    setupFilterButtons('selectedFilters', selectedFilters);
    loadTalents();
});