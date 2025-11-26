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
            //syncToOptimizer(statName, parseInt(preInput.value) || 0, parseInt(postInput.value) || 0);

            // Re-render talents to update availability
            renderBothPanels();
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
                //syncToOptimizer(statName, parseInt(preInput.value) || 0, parseInt(postInput.value) || 0);

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

   function calculateTotalPoints() {
    let totalPoints = 0;

    document.querySelectorAll('#stats-tab .stat-row.simple').forEach(row => {  
        //Get Post-Shrine Value
        const postInput = row.querySelector('.post-shrine');
        const postValue = parseInt(postInput.value) || 0;
        
      
        totalPoints += postValue;
    });

    return totalPoints;
}

function updateSparePoints() {
    const totalPoints = calculateTotalPoints();
    const sparePoints = MAX_TOTAL_POINTS - totalPoints;

    console.log(`Total Points Used: ${totalPoints}, Leftover Points: ${sparePoints}`);
    const sparePointsElement = document.getElementById('sparePointsValue');

    if (sparePointsElement) {
        sparePointsElement.textContent = sparePoints;

        // Remove all color classes
        sparePointsElement.classList.remove('negative', 'low', 'good');

        // Add appropriate color class
        if (sparePoints < 0) {
            sparePointsElement.classList.add('negative');
        } else if (sparePoints < 50) {
            sparePointsElement.classList.add('low');
        } else {
            sparePointsElement.classList.add('good');
        }
    }
}
    function getCurrentMaxBuildStats() {
        const stats = {};
        document.querySelectorAll('#stats-tab .stat-row.simple').forEach(row => {
            const statName = row.getAttribute('data-stat');
            const preInput = row.querySelector('.pre-shrine');
            const postInput = row.querySelector('.post-shrine');

            const preValue = parseInt(preInput.value) || 0;
            const postValue = parseInt(postInput.value) || 0;

            // Use the maximum of the two values for the talent check
            stats[statName] = Math.max(preValue, postValue);
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
        const inputGroup = select.closest('.input-group');

        // Find the input that corresponds to this select
        // Look backwards from the select to find the nearest input[type="number"] that's not a while-value-input
        let inputElement = select.previousElementSibling;
        while (inputElement && (inputElement.tagName !== 'INPUT' || inputElement.classList.contains('while-value-input'))) {
            inputElement = inputElement.previousElementSibling;
        }

        if (inputElement && inputElement.tagName === 'INPUT') {
            inputElement.setAttribute('data-condition', select.value);
        }

        // Find the container for this specific condition (input + select + optional while-controls)
        // We need to look for while-controls that are siblings of this select
        let whileControls = select.nextElementSibling;
        while (whileControls && !whileControls.classList.contains('while-controls') &&
            !whileControls.classList.contains('condition-select') &&
            !whileControls.tagName === 'INPUT') {
            whileControls = whileControls.nextElementSibling;
        }

        // If we found while-controls as the next sibling, that's the one for this select
        if (whileControls && whileControls.classList.contains('while-controls')) {
            // This select already has while-controls
            if (select.value !== 'while') {
                whileControls.remove();
            }
        } else if (select.value === 'while') {
            // Get the current stat name from the stat-row
            const statRow = select.closest('.stat-row');
            const currentStat = statRow.getAttribute('data-stat');

            // Need to create while controls
            whileControls = document.createElement('div');
            whileControls.className = 'while-controls';

            const statSelect = document.createElement('select');
            statSelect.className = 'while-stat-select';

            // Create options array, excluding the current stat
            const allStats = [
                'Strength', 'Fortitude', 'Agility', 'Intelligence', 'Willpower', 'Charisma',
                'Heavy Wep.', 'Medium Wep.', 'Light Wep.',
                'Flamecharm', 'Frostdraw', 'Thundercall', 'Galebreathe', 'Shadowcast', 'Ironsing', 'Bloodrend'
            ];

            const optionsHTML = allStats
                .filter(stat => stat !== currentStat)
                .map(stat => `<option value="${stat}">${stat}</option>`)
                .join('');

            statSelect.innerHTML = optionsHTML;

            const valueInput = document.createElement('input');
            valueInput.type = 'number';
            valueInput.className = 'while-value-input';
            valueInput.value = '0';
            valueInput.placeholder = 'Value';
            setupInputValidation(valueInput);

            whileControls.appendChild(statSelect);
            whileControls.appendChild(valueInput);

            // Insert after the select (or after the remove button if it exists)
            let insertAfter = select.nextElementSibling;
            if (insertAfter && insertAfter.classList.contains('remove-input-btn')) {
                // Insert after the remove button
                if (insertAfter.nextElementSibling) {
                    inputGroup.insertBefore(whileControls, insertAfter.nextElementSibling);
                } else {
                    inputGroup.appendChild(whileControls);
                }
            } else {
                // Insert right after the select
                if (insertAfter) {
                    inputGroup.insertBefore(whileControls, insertAfter);
                } else {
                    inputGroup.appendChild(whileControls);
                }
            }
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

            // Only count the main stat inputs, not while-condition inputs
            const mainInputs = Array.from(inputGroup.querySelectorAll('input[type="number"]')).filter(input =>
                !input.classList.contains('while-value-input')
            );

            if (mainInputs.length < 2) {
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
                <option value="while">While</option>
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

                    // Re-check the count after removal
                    const remainingMainInputs = Array.from(inputGroup.querySelectorAll('input[type="number"]')).filter(input =>
                        !input.classList.contains('while-value-input')
                    );
                    if (remainingMainInputs.length < 2) {
                        button.style.display = '';
                    }
                });
            }

            // Re-count after adding
            const totalMainInputs = Array.from(inputGroup.querySelectorAll('input[type="number"]')).filter(input =>
                !input.classList.contains('while-value-input')
            );
            if (totalMainInputs.length >= 2) {
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

            statRow.querySelectorAll('.input-group').forEach(inputGroup => {
                const input = inputGroup.querySelector('input[type="number"]');
                const value = parseInt(input.value) || 0;
                const condition = input.getAttribute('data-condition') || 'any';

                if (value > 0) {
                    const requirement = { value: value, condition: condition };

                    // If condition is "while", add the while stat and value
                    if (condition === 'while') {
                        const whileControls = inputGroup.querySelector('.while-controls');
                        if (whileControls) {
                            const whileStat = whileControls.querySelector('.while-stat-select').value;
                            const whileValue = parseInt(whileControls.querySelector('.while-value-input').value) || 0;
                            requirement.whileStat = whileStat;
                            requirement.whileValue = whileValue;
                        }
                    }

                    desiredStats[statName].push(requirement);
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
                hasAny: false,
                whileConditions: []
            };

            // Determine minimum pre/post requirements
            for (const req of requirements) {
                if (req.condition === 'pre') {
                    statRequirements[statName].minPre = Math.max(statRequirements[statName].minPre, req.value);
                } else if (req.condition === 'post') {
                    statRequirements[statName].minPost = Math.max(statRequirements[statName].minPost, req.value);
                } else if (req.condition === 'any') {
                    statRequirements[statName].hasAny = true;
                } else if (req.condition === 'while') {
                    statRequirements[statName].whileConditions.push({
                        value: req.value,
                        whileStat: req.whileStat,
                        whileValue: req.whileValue,
                        talentGroup: req.talentGroup,
                        allRequirements: req.allRequirements
                    });
                }
            }
        }

        // Generate all possible combinations for 'any' AND 'while' conditions
        function generateCombinations(statReqs) {
            const statsWithAny = [];
            const baseConfig = {};
            const whileGroups = {}; // Track which stats belong to the same talent group

            for (const [statName, data] of Object.entries(statReqs)) {
                baseConfig[statName] = {
                    isAttunement: data.isAttunement,
                    minPre: data.minPre,
                    minPost: data.minPost,
                    anyRequirements: [],
                    whileConditions: []
                };

                if (data.hasAny) {
                    const anyReqs = data.requirements.filter(r => r.condition === 'any');
                    baseConfig[statName].anyRequirements = anyReqs;
                    statsWithAny.push(statName);
                }

                if (data.whileConditions && data.whileConditions.length > 0) {
                    baseConfig[statName].whileConditions = data.whileConditions;

                    // Group while-conditions by talent
                    data.whileConditions.forEach(cond => {
                        if (cond.talentGroup) {
                            if (!whileGroups[cond.talentGroup]) {
                                whileGroups[cond.talentGroup] = [];
                            }
                            whileGroups[cond.talentGroup].push({
                                stat: statName,
                                value: cond.value,
                                allRequirements: cond.allRequirements
                            });
                        }
                    });
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

                // Now handle 'while' conditions - generate pre/post variants
                // For while conditions, ALL stats in the same talent group must be in the same phase
                const whileVariants = [];

                if (Object.keys(whileGroups).length > 0) {
                    // For each talent group, try both pre and post
                    const groupKeys = Object.keys(whileGroups);
                    const totalWhileCombinations = Math.pow(2, groupKeys.length);

                    for (let j = 0; j < totalWhileCombinations; j++) {
                        const whileConfig = JSON.parse(JSON.stringify(config));

                        groupKeys.forEach((groupKey, index) => {
                            const isPre = (j >> index) & 1;
                            const group = whileGroups[groupKey];

                            // Apply the SAME phase choice to ALL stats in this talent group
                            if (isPre) {
                                // All requirements in this group go to pre-shrine
                                group.forEach(item => {
                                    whileConfig[item.stat].minPre = Math.max(
                                        whileConfig[item.stat].minPre,
                                        item.value
                                    );
                                });
                            } else {
                                // All requirements in this group go to post-shrine
                                group.forEach(item => {
                                    whileConfig[item.stat].minPost = Math.max(
                                        whileConfig[item.stat].minPost,
                                        item.value
                                    );
                                });
                            }
                        });

                        whileVariants.push(whileConfig);
                    }
                } else {
                    whileVariants.push(config);
                }

                combinations.push(...whileVariants);
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

            // IMPROVED SCORING: Heavily favor solutions with more leftover points
            // Also reward efficient use of shrine averaging
            const leftoverPoints = MAX_TOTAL_POINTS - totalPoints;
            const shrineEfficiency = statsToInclude.size > 1 ? (statsToInclude.size * 100) : 0;
            const score = (leftoverPoints * 1000) + shrineEfficiency;

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
            console.log('Shrine Leftover:', bestSolution.shrineLeftover);

            console.log('\nFinal Stats:');
            console.table(bestSolution.finalStats);

            console.log(`\nTotal Points Used: ${bestSolution.totalPreInvestment + bestSolution.totalPostInvestment}`);
            console.log(`Leftover Points: ${bestSolution.leftoverPoints}`);
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

    // Rarity toggle states
    let showOriginTalents = true;
    let showQuestTalents = true;
    let showOathTalents = true

    // Sort settings
    let availableSortBy = 'points';
    let availableSortOrder = 'desc';
    let selectedSortBy = 'points';
    let selectedSortOrder = 'desc';


    let pendingTalentSelection = null;
    let pendingOptimalBuild = null;

    // Fetch talents data
    async function loadTalents() {
        try {
            const response = await fetch('./proxy.json');
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

    document.getElementById('clearAllTalents')?.addEventListener('click', () => {
        if (selectedTalents.size === 0) return;

        const confirm = window.confirm(
            `Are you sure you want to remove all ${selectedTalents.size} selected talents and clear your build?`
        );

        if (confirm) {
            selectedTalents.clear();
            recalculateBuildForRemainingTalents();
            renderBothPanels();
        }
    });

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

    function isTalentAvailable(talent, currentStats) {
        const requirements = getTalentRequirements(talent);

        // Talent is available if it has no requirements or all requirements are met
        if (requirements.length === 0) return true;

        for (const req of requirements) {
            // Check if the current stat value is less than the required value
            if ((currentStats[req.stat] || 0) < req.value) {
                return false;
            }
        }
        return true;
    }

    // Function to sort talents
    function sortTalents(talents, sortBy, sortOrder) {
        return [...talents].sort((a, b) => {
            let compareValue = 0;

            if (sortBy === 'name') {
                compareValue = a.name.localeCompare(b.name);
            } else if (sortBy === 'points') {
                // Get the total points required (sum of all requirements)
                const aPoints = getTalentTotalPoints(a);
                const bPoints = getTalentTotalPoints(b);
                compareValue = aPoints - bPoints;
            }

            // Reverse if descending order
            return sortOrder === 'desc' ? -compareValue : compareValue;
        });
    }

    // Helper function to get total points for a talent
    function getTalentTotalPoints(talent) {
        const requirements = getTalentRequirements(talent);
        if (requirements.length === 0) return 0;

        // Sum up all requirement values
        return requirements.reduce((sum, req) => sum + req.value, 0);
    }

    function requiresOath(talent, visited = new Set()) {
        // Prevent infinite loops
        if (visited.has(talent.id)) {
            return false;
        }
        visited.add(talent.id);

        // Check if this talent directly requires an oath
        if (talent.reqs && talent.reqs.from) {
            if (talent.reqs.from.includes('Oath:')) {
                return true;
            }
        }

        // Check if any required talents require an oath
        const requiredTalentNames = getRequiredTalentNames(talent);
        for (const reqName of requiredTalentNames) {
            const requiredTalent = findTalentByName(reqName);
            if (requiredTalent && requiresOath(requiredTalent, visited)) {
                return true;
            }
        }

        return false;
    }

    // Function to filter talents by rarity
    function filterByRarity(talents) {
        return talents.filter(talent => {
            const rarity = talent.rarity;

            // If Origin talent and toggle is off, filter it out
            if (rarity === 'Origin' && !showOriginTalents) {
                return false;
            }

            // If Quest talent and toggle is off, filter it out
            if (rarity === 'Quest' && !showQuestTalents) {
                return false;
            }

            // If talent requires oath and toggle is off, filter it out
            if (!showOathTalents && requiresOath(talent)) {
                return false;
            }

            return true;
        });
    }

    function createTalentCard(talent, isSelected = false) {
        const card = document.createElement('div');
        card.className = 'talent-card';
        card.dataset.talentId = talent.id;

        const requirements = getTalentRequirements(talent);

        // Check if this talent has conflicts with any selected talents
        const conflictingTalents = [];
        if (talent.exclusiveWith && talent.exclusiveWith.length > 0) {
            talent.exclusiveWith.forEach(exclusiveName => {
                if (!exclusiveName || exclusiveName === '') return;
                const exclusiveTalent = findTalentByName(exclusiveName);
                if (exclusiveTalent && selectedTalents.has(exclusiveTalent.id)) {
                    conflictingTalents.push(exclusiveName);
                }
            });
        }

        const hasExclusiveConflict = conflictingTalents.length > 0;

        // Add conflict class if there's an actual conflict
        if (hasExclusiveConflict) {
            card.classList.add('exclusive-conflict');
        }

        // Get the "from" field if it exists
        let fromHTML = '';
        if (talent.reqs && talent.reqs.from) {
            fromHTML = `<div class="talent-from">From: ${talent.reqs.from}</div>`;
        }

        // Get the stats field if it exists and is not "N/A"
        let statsHTML = '';
        if (talent.stats && talent.stats !== 'N/A' && talent.stats.trim() !== '') {
            statsHTML = `<div class="talent-stats">${talent.stats}</div>`;
        }

        // Only show exclusive warning if there's an actual conflict
        let exclusiveHTML = '';
        if (hasExclusiveConflict) {
            const exclusivesList = conflictingTalents.join(', ');
            exclusiveHTML = `<div class="talent-exclusive">Conflicts with: ${exclusivesList}</div>`;
        }

        let reqsHTML = '';
        if (requirements.length > 0) {
            reqsHTML = '<div class="talent-requirements">';
            requirements.forEach(req => {
                reqsHTML += `<span class="req-badge">${req.stat}: ${req.value}</span>`;
            });
            reqsHTML += '</div>';
        }

        const nameClass = hasExclusiveConflict ? 'talent-name conflict' : 'talent-name';

        card.innerHTML = `
        <div class="talent-header">
            <span class="${nameClass}">${talent.name}</span>
            <span class="talent-rarity">${talent.rarity || 'Common'}</span>
        </div>
        <div class="talent-desc">${talent.desc || 'No description available'}</div>
        ${fromHTML}
        ${statsHTML}
        ${exclusiveHTML}
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




    // Add this new function to find a talent by name
    function findTalentByName(talentName) {
        return allTalents.find(t => t.name.toLowerCase() === talentName.toLowerCase());
    }

    // Add this new function to get required talent names
    function getRequiredTalentNames(talent) {
        const requiredTalents = [];

        if (talent.reqs && talent.reqs.from) {
            // Parse the "from" field - it can contain multiple talents separated by commas
            const fromParts = talent.reqs.from.split(',').map(part => part.trim());

            fromParts.forEach(part => {
                // Skip "Oath:" prefix and other non-talent identifiers
                if (part.startsWith('Oath:') ||
                    part.startsWith('Race:') ||
                    part.startsWith('Origin:') ||
                    part.startsWith('Murmur:') ||
                    part.startsWith('Resonance:')) {
                    return;
                }

                // The part should be a talent name
                requiredTalents.push(part);
            });
        }

        return requiredTalents;
    }

    // Add this new recursive function to select talent and its dependencies
    function selectTalentWithDependencies(talentId, visited = new Set()) {
        // Prevent infinite loops
        if (visited.has(talentId)) {
            return;
        }
        visited.add(talentId);

        const talent = allTalents.find(t => t.id === talentId);
        if (!talent) {
            return;
        }

        // Get required talents
        const requiredTalentNames = getRequiredTalentNames(talent);

        // Recursively select required talents first
        requiredTalentNames.forEach(reqName => {
            const requiredTalent = findTalentByName(reqName);
            if (requiredTalent && !selectedTalents.has(requiredTalent.id)) {
                selectTalentWithDependencies(requiredTalent.id, visited);
            }
        });

        // Finally, select this talent
        selectedTalents.add(talentId);
    }

    // Update the selectTalent function
    // Update the selectTalent function to handle talent requirements as 'while' conditions
    function selectTalent(talentId) {
        // Store the pending selection
        pendingTalentSelection = {
            talentId: talentId,
            dependencyIds: []
        };

        // Collect all dependencies
        const visited = new Set();
        collectDependencies(talentId, visited);
        pendingTalentSelection.dependencyIds = Array.from(visited);

        // Get current build stats (max of pre and post)
        const currentMaxStats = getCurrentMaxBuildStats();

        // Get requirements from new talents
        const newTalents = pendingTalentSelection.dependencyIds.map(id => allTalents.find(t => t.id === id)).filter(t => t);

        // Check if all requirements are already met
        let allRequirementsMet = true;
        for (const talent of newTalents) {
            const requirements = getTalentRequirements(talent);
            for (const req of requirements) {
                if ((currentMaxStats[req.stat] || 0) < req.value) {
                    allRequirementsMet = false;
                    break;
                }
            }
            if (!allRequirementsMet) break;
        }

        // If all requirements are met, just add the talents without showing modal
        if (allRequirementsMet) {
            pendingTalentSelection.dependencyIds.forEach(id => {
                selectedTalents.add(id);
            });
            pendingTalentSelection = null;
            renderBothPanels();
            return;
        }

        // ==========================================
        // FIXED: Accumulate requirements from ALL selected talents + new talents
        // ==========================================

        // Get ALL currently selected talents
        const allSelectedTalents = Array.from(selectedTalents)
            .map(id => allTalents.find(t => t.id === id))
            .filter(t => t);

        // Combine with new talents we're about to add
        const allTalentsToConsider = [...allSelectedTalents, ...newTalents];

        const combinedRequirements = {};

        // Process ALL talents (existing + new)
        allTalentsToConsider.forEach((talent, talentIndex) => {
            const requirements = getTalentRequirements(talent);

            if (requirements.length === 0) return;

            requirements.forEach(req => {
                if (!combinedRequirements[req.stat]) {
                    combinedRequirements[req.stat] = [];
                }

                if (requirements.length === 1) {
                    // Single requirement can be pre or post
                    combinedRequirements[req.stat].push({
                        value: req.value,
                        condition: 'any'
                    });
                } else {
                    // Multiple requirements from same talent must be together (while condition)
                    combinedRequirements[req.stat].push({
                        value: req.value,
                        condition: 'while',
                        talentGroup: `talent_${talent.id}`,  // Group identifier
                        allRequirements: requirements  // Store all requirements
                    });
                }
            });
        });

        const deduplicatedRequirements = deduplicateRequirements(combinedRequirements);

        // ==========================================
        // DEBUGGING: Show all combined requirements
        // ==========================================
        console.log('=== TALENT SELECTION DEBUG ===');
        console.log('New talents being added:', newTalents.map(t => t.name));
        console.log('Already selected talents:', allSelectedTalents.map(t => t.name));
        console.log('\n--- Combined Requirements ---');

        for (const [statName, requirements] of Object.entries(deduplicatedRequirements)) {
            console.log(`\n[${statName}]:`);
            requirements.forEach((req, index) => {
                if (req.condition === 'any') {
                    console.log(`  ${index + 1}. Value: ${req.value}, Condition: ANY`);
                } else if (req.condition === 'while') {
                    const otherStats = req.allRequirements
                        .filter(r => r.stat !== statName)
                        .map(r => `${r.stat}: ${r.value}`)
                        .join(', ');
                    console.log(`  ${index + 1}. Value: ${req.value}, Condition: WHILE (${otherStats}), Group: ${req.talentGroup}`);
                } else {
                    console.log(`  ${index + 1}. Value: ${req.value}, Condition: ${req.condition}`);
                }
            });
        }
        console.log('\n==============================\n');

        const hasNewRequirements = newTalents.some(talent => getTalentRequirements(talent).length > 0);

        // Only calculate if there are actual requirements
        if (Object.keys(deduplicatedRequirements).length > 0) {
            const optimalBuild = calculateOptimalOrder(deduplicatedRequirements);

            if (optimalBuild) {
                pendingOptimalBuild = optimalBuild;
                showTalentConfirmationModal(pendingTalentSelection.dependencyIds, optimalBuild, hasNewRequirements);
            } else {
                alert('Warning: No optimal build found within constraints. Talents won\'t be added.');
            }
        } else if (!hasNewRequirements) {
            // No requirements at all - just add the talents
            confirmTalentSelection();
        } else {
            alert('Warning: No optimal build found within constraints. Talents won\'t be added.');
        }
    }
    // Add function to collect dependencies
    function collectDependencies(talentId, visited = new Set()) {
        if (visited.has(talentId)) {
            return;
        }
        visited.add(talentId);

        const talent = allTalents.find(t => t.id === talentId);
        if (!talent) {
            return;
        }

        const requiredTalentNames = getRequiredTalentNames(talent);

        requiredTalentNames.forEach(reqName => {
            const requiredTalent = findTalentByName(reqName);
            if (requiredTalent && !selectedTalents.has(requiredTalent.id)) {
                collectDependencies(requiredTalent.id, visited);
            }
        });
    }

    // Add this function after collectDependencies
    function deduplicateRequirements(requirements) {
        const deduplicated = {};

        for (const [statName, reqs] of Object.entries(requirements)) {
            deduplicated[statName] = [];

            // Group by condition type
            const anyReqs = reqs.filter(r => r.condition === 'any');
            const whileReqs = reqs.filter(r => r.condition === 'while');

            // For ANY requirements, only keep the maximum value
            if (anyReqs.length > 0) {
                const maxAny = Math.max(...anyReqs.map(r => r.value));
                deduplicated[statName].push({
                    value: maxAny,
                    condition: 'any'
                });
            }

            // For WHILE requirements, deduplicate by talent group
            const whileGroups = {};
            whileReqs.forEach(req => {
                const group = req.talentGroup;
                if (!whileGroups[group] || whileGroups[group].value < req.value) {
                    whileGroups[group] = req;
                }
            });

            deduplicated[statName].push(...Object.values(whileGroups));
        }

        return deduplicated;
    }

    // Add function to calculate optimal build for talents
    function calculateOptimalBuildForTalents(talents) {
        const desiredStats = {};

        // Collect all requirements from all talents
        talents.forEach(talent => {
            const requirements = getTalentRequirements(talent);
            requirements.forEach(req => {
                if (!desiredStats[req.stat]) {
                    desiredStats[req.stat] = [];
                }
                // Use the maximum requirement for each stat
                const existingReq = desiredStats[req.stat].find(r => r.condition === 'any');
                if (existingReq) {
                    existingReq.value = Math.max(existingReq.value, req.value);
                } else {
                    desiredStats[req.stat].push({ value: req.value, condition: 'any' });
                }
            });
        });

        // Use the existing calculateOptimalOrder function
        return calculateOptimalOrder(desiredStats);
    }

    // Update the showTalentConfirmationModal function to show the actual shrine calculations
    function showTalentConfirmationModal(talentIds, optimalBuild) {
        const modal = document.getElementById('talentConfirmationModal');
        const messageEl = document.getElementById('talentConfirmationMessage');
        const talentsList = document.getElementById('selectedTalentsList');
        const buildComparisonSection = document.getElementById('buildComparisonSection');

        // Get current build stats
        const currentBuild = collectManualBuildStats();

        // Show talents being added
        const talentsToAdd = talentIds.map(id => allTalents.find(t => t.id === id)).filter(t => t);

        if (talentsToAdd.length === 1) {
            messageEl.textContent = `Adding "${talentsToAdd[0].name}" requires the following stats:`;
        } else {
            messageEl.textContent = `Adding these talents requires the following stats:`;
        }

        talentsList.innerHTML = '';
        talentsToAdd.forEach(talent => {
            const li = document.createElement('li');
            const requirements = getTalentRequirements(talent);

            if (requirements.length > 0) {
                const reqText = requirements.map(r => `${r.stat}: ${r.value}`).join(', ');
                li.innerHTML = `<strong>${talent.name}</strong><br><span style="font-size: 0.85em; color: var(--card-text-secondary);">${reqText}</span>`;
            } else {
                li.textContent = talent.name;
            }

            talentsList.appendChild(li);
        });

        // Show build comparison
        buildComparisonSection.innerHTML = '';

        if (!optimalBuild) {
            buildComparisonSection.innerHTML = '<div class="no-changes-message">No optimal build could be calculated.</div>';
        } else {
            const comparisonDiv = document.createElement('div');
            comparisonDiv.className = 'build-comparison';

            // Current build column
            const currentColumn = document.createElement('div');
            currentColumn.className = 'build-column';
            currentColumn.innerHTML = '<h3>Current Stats</h3>';

            // Optimal build column
            const optimalColumn = document.createElement('div');
            optimalColumn.className = 'build-column';
            optimalColumn.innerHTML = '<h3>Optimal Stats</h3>';

            // Collect all unique stats
            const allStats = new Set([
                ...Object.keys(currentBuild.pre),
                ...Object.keys(currentBuild.post),
                ...Object.keys(optimalBuild.preShrine || {}),
                ...Object.keys(optimalBuild.finalStats || {})
            ]);

            allStats.forEach(stat => {
                const currentPre = currentBuild.pre[stat] || 0;
                const currentPost = currentBuild.post[stat] || 0;
                const currentMax = Math.max(currentPre, currentPost);

                const optimalPre = (optimalBuild.preShrine && optimalBuild.preShrine[stat]) ? optimalBuild.preShrine[stat].currentPre : 0;

                // Calculate the actual post-shrine value
                const postShrineValue = optimalBuild.postShrine[stat] || 0;
                const optimalFinal = optimalBuild.finalStats[stat] || 0;
                const additionalInvestment = optimalFinal - postShrineValue;

                // Show post-shrine value and additional investment separately
                let optimalPostDisplay;
                if (postShrineValue > 0 && additionalInvestment > 0) {
                    optimalPostDisplay = `${optimalFinal}`;
                } else if (postShrineValue > 0) {
                    optimalPostDisplay = `${Math.floor(postShrineValue)}`;
                } else {
                    optimalPostDisplay = `${optimalFinal}`;
                }

                const changed = false//(currentPre !== optimalPre || currentPost !== optimalFinal) && (optimalPre > 0 || optimalFinal > 0);


                // Current build stat
                const currentStatDiv = document.createElement('div');
                currentStatDiv.className = 'build-stat-item' + (changed ? ' changed' : '');
                currentStatDiv.innerHTML = `
                <span>${stat}:</span>
                <span>${currentPre} | ${currentPost}</span>
            `;
                currentColumn.appendChild(currentStatDiv);

                // Optimal build stat
                const optimalStatDiv = document.createElement('div');
                optimalStatDiv.className = 'build-stat-item' + (changed ? ' changed' : '');
                optimalStatDiv.innerHTML = `
                <span>${stat}:</span>
                <span>${optimalPre} | ${optimalPostDisplay}</span>
            `;
                optimalColumn.appendChild(optimalStatDiv);
            });

            comparisonDiv.appendChild(currentColumn);
            comparisonDiv.appendChild(optimalColumn);
            buildComparisonSection.appendChild(comparisonDiv);
        }

        modal.classList.add('active');
    }

    // Add function to confirm talent selection
    function confirmTalentSelection() {
        if (!pendingTalentSelection) return;

        // Add all pending talents
        pendingTalentSelection.dependencyIds.forEach(id => {
            selectedTalents.add(id);
        });

        // Apply optimal build if available
        if (pendingOptimalBuild) {
            applyOptimalBuildToStats(pendingOptimalBuild);
        }

        // Clear pending data
        pendingTalentSelection = null;
        pendingOptimalBuild = null;

        // Close modal and re-render
        document.getElementById('talentConfirmationModal').classList.remove('active');
        renderBothPanels();
    }

    // Add function to decline talent selection
    function declineTalentSelection() {
        // Clear pending data without adding talents
        pendingTalentSelection = null;
        pendingOptimalBuild = null;

        // Close modal
        document.getElementById('talentConfirmationModal').classList.remove('active');
    }

    function applyOptimalBuildToStats(solution) {
        // Clear all inputs first
        document.querySelectorAll('#stats-tab .stat-row.simple').forEach(row => {
            const preInput = row.querySelector('.pre-shrine');
            const postInput = row.querySelector('.post-shrine');
            preInput.value = 0;
            postInput.value = 0;
        });

        // Apply pre-shrine values
        for (const [statName, data] of Object.entries(solution.preShrine || {})) {
            const statRow = document.querySelector(`#stats-tab .stat-row.simple[data-stat="${statName}"]`);
            if (statRow) {
                const preInput = statRow.querySelector('.pre-shrine');
                preInput.value = data.currentPre;
            }
        }

        // NOW recalculate the shrine with the pre-shrine values we just set
        const preShrineBuild = {};
        document.querySelectorAll('#stats-tab .stat-row.simple').forEach(row => {
            const statName = row.getAttribute('data-stat');
            const preInput = row.querySelector('.pre-shrine');
            const preValue = parseInt(preInput.value) || 0;

            if (preValue > 0) {
                preShrineBuild[statName] = preValue;
            }
        });

        // Simulate shrine averaging with the pre-shrine values
        const shrineResult = simulateShrineAveraging(preShrineBuild);

        // Apply post-shrine values (shrine result + additional investment)
        for (const [statName, finalValue] of Object.entries(solution.finalStats || {})) {
            const statRow = document.querySelector(`#stats-tab .stat-row.simple[data-stat="${statName}"]`);
            if (statRow) {
                const postInput = statRow.querySelector('.post-shrine');
                const postShrineValue = shrineResult.postShrine[statName] || 0;

                // If stat was in shrine, apply shrine result + additional investment
                if (postShrineValue > 0) {
                    const additionalInvestment = finalValue - postShrineValue;
                    postInput.value = postShrineValue + Math.max(0, additionalInvestment);
                } else {
                    // If stat wasn't in shrine, apply full final value
                    postInput.value = finalValue;
                }
            }
        }

        // Sync to optimizer for all stats
        document.querySelectorAll('#stats-tab .stat-row.simple').forEach(row => {
            const statName = row.getAttribute('data-stat');
            const preInput = row.querySelector('.pre-shrine');
            const postInput = row.querySelector('.post-shrine');
            const preValue = parseInt(preInput.value) || 0;
            const postValue = parseInt(postInput.value) || 0;

            syncToOptimizer(statName, preValue, postValue);
        });

        updateSparePoints();
    }

    function unselectTalent(talentId) {
        // Remove the talent
        selectedTalents.delete(talentId);

        // Check if any remaining talents depend on this one
        const dependentTalents = [];
        for (const selectedId of selectedTalents) {
            const talent = allTalents.find(t => t.id === selectedId);
            if (!talent) continue;

            const requiredNames = getRequiredTalentNames(talent);
            const removedTalent = allTalents.find(t => t.id === talentId);

            if (removedTalent && requiredNames.includes(removedTalent.name)) {
                dependentTalents.push(talent.name);
            }
        }

        // If there are dependent talents, warn the user
        if (dependentTalents.length > 0) {
            const confirm = window.confirm(
                `Warning: The following talents depend on "${allTalents.find(t => t.id === talentId)?.name}":\n\n` +
                dependentTalents.join('\n') +
                `\n\nRemoving this talent may make your build invalid. Continue?`
            );

            if (!confirm) {
                // Re-add the talent if user cancels
                selectedTalents.add(talentId);
                renderBothPanels();
                return;
            }
        }

        // Recalculate build with remaining talents
        recalculateBuildForRemainingTalents();

        // Re-render both panels
        renderBothPanels();
    }

    // Add this new function to recalculate the build
    function recalculateBuildForRemainingTalents() {
        // If no talents selected, clear the build
        if (selectedTalents.size === 0) {
            document.querySelectorAll('#stats-tab .stat-row.simple').forEach(row => {
                const preInput = row.querySelector('.pre-shrine');
                const postInput = row.querySelector('.post-shrine');
                preInput.value = 0;
                postInput.value = 0;
            });
            updateSparePoints();
            return;
        }

        // Get all remaining selected talents
        const remainingTalents = Array.from(selectedTalents)
            .map(id => allTalents.find(t => t.id === id))
            .filter(t => t);

        // Collect requirements from remaining talents
        const combinedRequirements = {};

        remainingTalents.forEach(talent => {
            const requirements = getTalentRequirements(talent);
            if (requirements.length === 0) return;

            requirements.forEach(req => {
                if (!combinedRequirements[req.stat]) {
                    combinedRequirements[req.stat] = [];
                }

                if (requirements.length === 1) {
                    combinedRequirements[req.stat].push({
                        value: req.value,
                        condition: 'any'
                    });
                } else {
                    combinedRequirements[req.stat].push({
                        value: req.value,
                        condition: 'while',
                        talentGroup: `talent_${talent.id}`,
                        allRequirements: requirements
                    });
                }
            });
        });

        // Deduplicate requirements
        const deduplicatedRequirements = deduplicateRequirements(combinedRequirements);

        // Calculate optimal build for remaining talents
        if (Object.keys(deduplicatedRequirements).length > 0) {
            const optimalBuild = calculateOptimalOrder(deduplicatedRequirements);

            if (optimalBuild) {
                // Apply the new optimal build
                applyOptimalBuildToStats(optimalBuild);
                console.log('Build recalculated for remaining talents');
            } else {
                console.warn('Could not find optimal build for remaining talents');
            }
        } else {
            // No requirements, clear the build
            document.querySelectorAll('#stats-tab .stat-row.simple').forEach(row => {
                const preInput = row.querySelector('.pre-shrine');
                const postInput = row.querySelector('.post-shrine');
                preInput.value = 0;
                postInput.value = 0;
            });
            updateSparePoints();
        }
    }

    function matchesFilters(talent, activeFilters, currentStats) {
        // 1. Handle Availability Filters
        const wantsAvailable = activeFilters.has('available');
        const wantsUnavailable = activeFilters.has('unavailable');

        if (wantsAvailable || wantsUnavailable) {
            const available = isTalentAvailable(talent, currentStats);

            if (wantsAvailable && !available) return false;
            if (wantsUnavailable && available) return false;
        }

        // 2. Handle Stat Filters (existing logic)
        const statFilters = new Set([...activeFilters].filter(f => f !== 'available' && f !== 'unavailable'));

        if (statFilters.size === 0) return true;

        const requirements = getTalentRequirements(talent);
        const talentStats = new Set(requirements.map(req => req.stat));

        // Talent must have ALL of the active stat filters (AND logic)
        for (const filter of statFilters) {
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
        const currentStats = getCurrentMaxBuildStats();

        // Filter out selected talents
        let available = allTalents.filter(t => !selectedTalents.has(t.id));

        // Apply rarity filter
        available = filterByRarity(available);

        if (available.length === 0) {
            container.innerHTML = '<p class="empty-message">All talents selected</p>';
            return;
        }

        container.innerHTML = '';

        let visibleCount = 0;

        // Sort the talents before rendering
        available = sortTalents(available, availableSortBy, availableSortOrder);

        available.forEach(talent => {
            const card = createTalentCard(talent, false);

            const matchesFilter = matchesFilters(talent, availableFilters, currentStats);
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
        const currentStats = {};

        let selected = allTalents.filter(t => selectedTalents.has(t.id));

        if (selected.length === 0) {
            container.innerHTML = '<p class="empty-message">No talents selected</p>';
            return;
        }

        container.innerHTML = '';

        let visibleCount = 0;

        // Sort the selected talents before rendering
        selected = sortTalents(selected, selectedSortBy, selectedSortOrder);

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

    // Setup rarity toggles
    document.getElementById('toggleOrigin').addEventListener('change', (e) => {
        showOriginTalents = e.target.checked;
        renderAvailableTalents();
    });

    document.getElementById('toggleQuest').addEventListener('change', (e) => {
        showQuestTalents = e.target.checked;
        renderAvailableTalents();
    });

    document.getElementById('toggleOath').addEventListener('change', (e) => {
        showOathTalents = e.target.checked;
        renderAvailableTalents();
    });

    // Setup sort controls for available talents
    document.getElementById('sortBy').addEventListener('change', (e) => {
        availableSortBy = e.target.value;
        renderAvailableTalents();
    });

    document.getElementById('sortOrder').addEventListener('change', (e) => {
        availableSortOrder = e.target.value;
        renderAvailableTalents();
    });

    // Setup sort controls for selected talents
    document.getElementById('sortBySelected').addEventListener('change', (e) => {
        selectedSortBy = e.target.value;
        renderSelectedTalents();
    });

    document.getElementById('sortOrderSelected').addEventListener('change', (e) => {
        selectedSortOrder = e.target.value;
        renderSelectedTalents();
    });

    document.getElementById('confirmBuildBtn').addEventListener('click', confirmTalentSelection);
    document.getElementById('declineBuildBtn').addEventListener('click', declineTalentSelection);

    // Close modal when clicking outside
    document.getElementById('talentConfirmationModal').addEventListener('click', (e) => {
        if (e.target.id === 'talentConfirmationModal') {
            declineTalentSelection();
        }
    });

    document.getElementById('sortBy').value = availableSortBy;
    document.getElementById('sortOrder').value = availableSortOrder;
    document.getElementById('sortBySelected').value = selectedSortBy;
    document.getElementById('sortOrderSelected').value = selectedSortOrder;

    // Initialize talents tab
    setupFilterButtons('availableFilters', availableFilters);
    setupFilterButtons('selectedFilters', selectedFilters);
    loadTalents();
});