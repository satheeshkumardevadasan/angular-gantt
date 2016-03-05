/*
Project: angular-gantt v1.2.13 - Gantt chart component for AngularJS
Authors: Marco Schweighauser, Rémi Alvergnat
License: MIT
Homepage: https://www.angular-gantt.com
Github: https://github.com/angular-gantt/angular-gantt.git
*/
(function() {
    'use strict';
    angular.module('gantt.overlap', ['gantt', 'gantt.overlap.templates']).directive('ganttOverlap', ['moment', function(moment) {
        return {
            restrict: 'E',
            require: '^gantt',
            scope: {
                enabled: '=?',
                global: '=?',
                stackTasks: '=?',
                stackHeight: '=?',
                stackHeightUnit: '=?'
            },
            link: function(scope, element, attrs, ganttCtrl) {
                var api = ganttCtrl.gantt.api;
                var initialStackLevel = 1;
                var overlapCss = 'gantt-task-overlaps';

                if (scope.enabled === undefined) {
                    scope.enabled = true;
                }

                if (scope.global === undefined) {
                    scope.global = false;
                }

                if (scope.stackTasks === undefined) {
                    scope.stackTasks = false;
                }

                if (scope.stackHeight === undefined) {
                    scope.stackHeight = 2;
                }

                if (scope.stackHeightUnit === undefined) {
                    scope.stackHeightUnit = 'em';
                }

                function getStartEnd(task) {
                    var start, end;

                    if (task.model.from.isBefore(task.model.to)) {
                        start = task.model.from;
                        end = task.model.to;
                    } else {
                        start = task.model.to;
                        end = task.model.from;
                    }

                    return [start, end];
                }

                function getRange(task) {
                    var startEnd = getStartEnd(task);
                    return moment().range(startEnd[0], startEnd[1]);
                }

                function handleTaskOverlap(overlapsDict, overlapsList, task) {
                    if (!(task.model.id in overlapsDict)) {
                        task.overlaps = true;
                        task.$element.addClass(overlapCss);
                        overlapsList.push(task);
                        overlapsDict[task.model.id] = task;
                    }
                }

                function handleTaskNonOverlaps(overlapsDict, allTasks) {
                    for (var i = 0, l = allTasks.length; i < l; i++) {
                        var task = allTasks[i];
                        if (!(task.model.id in overlapsDict)) {
                            task.overlaps = false;
                            task.$element.removeClass(overlapCss);
                        }
                    }
                }

                function assignStackLevel(task, range, levels) {
                    var addNewLevel = true;
                    for(var level = 0, l = levels.length; level < l; level++) {
                        if (!range.overlaps(levels[level])) {
                            task.stackLevel = initialStackLevel+level;
                            levels[level] = range;
                            addNewLevel = false;
                            break;
                        }
                    }

                    if (addNewLevel) {
                        task.stackLevel = initialStackLevel+levels.length;
                        levels.push(range);
                    }
                }

                function handleOverlaps(tasks) {
                    var newOverlapsTasksDict = {};
                    var newOverlapsTasks = [];
                    var levels = [];

                    if (tasks.length > 0) {
                        var previousTask = tasks[0];
                        var previousRange = getRange(previousTask);

                        previousTask.stackLevel = initialStackLevel;
                        levels.push(previousRange);

                        for (var i = 1, k = tasks.length; i < k; i++) {
                            var task = tasks[i];
                            var range = getRange(task);

                            // Set overlap flag to both tasks
                            if (range.overlaps(previousRange)) {
                                handleTaskOverlap(newOverlapsTasksDict, newOverlapsTasks, previousTask);
                                handleTaskOverlap(newOverlapsTasksDict, newOverlapsTasks, task);
                            }

                            // Assign stack level to current task
                            assignStackLevel(task, range, levels);

                            if (previousTask.left + previousTask.width < task.left + task.width) {
                                previousTask = task;
                                previousRange = range;
                            }
                        }
                    }

                    handleTaskNonOverlaps(newOverlapsTasksDict, tasks);
                }

                function sortOn(array, supplier) {
                    return array.sort(function(a, b) {
                        if (supplier(a) < supplier(b)) {
                            return -1;
                        } else if (supplier(a) > supplier(b)) {
                            return 1;
                        }
                        return 0;
                    });
                }

                function handleGlobalOverlaps(rows) {
                    var globalTasks = [];
                    for (var i = 0; i < rows.length; i++) {
                        globalTasks.push.apply(globalTasks, rows[i].tasks);
                    }

                    globalTasks = sortOn(globalTasks, function(task) {
                        return task.model.from;
                    });

                    handleOverlaps(globalTasks);
                }

                function applyStackLevel(task) {
                    var top = (task.stackLevel - initialStackLevel) * scope.stackHeight;
                    task.$element.css({'top': top + scope.stackHeightUnit});
                }

                function applyStackLevels(row) {
                    if (scope.stackTasks) {
                        var tasks = row.tasks;
                        var maxStackLevel = initialStackLevel;

                        for (var i = 0, l = tasks.length; i < l; i++) {
                            var task = tasks[i];
                            applyStackLevel(task);
                            maxStackLevel = Math.max(maxStackLevel, task.stackLevel);
                        }

                        row.height = maxStackLevel * scope.stackHeight + scope.stackHeightUnit;
                    } else {
                        row.height = undefined;
                    }
                }

                if (scope.enabled) {
                    api.core.on.rendered(scope, function(api) {
                        var rows = api.gantt.rowsManager.rows;

                        if (scope.global) {
                            handleGlobalOverlaps(rows);
                        } else {
                            for (var i = 0; i < rows.length; i++) {
                                handleOverlaps(rows[i].tasks);
                                applyStackLevels(rows[i]);
                            }
                        }
                    });

                    api.tasks.on.change(scope, function(task) {
                        if (scope.global) {
                            var rows = task.row.rowsManager.rows;
                            handleGlobalOverlaps(rows);
                        } else {
                            handleOverlaps(task.row.tasks);
                            applyStackLevels(task.row);
                        }
                    });

                    api.tasks.on.rowChange(scope, function(task, oldRow) {
                        if (scope.global) {
                            var rows = oldRow.rowsManager.rows;
                            handleGlobalOverlaps(rows);
                        } else {
                            handleOverlaps(oldRow.tasks);
                            applyStackLevels(task.row);
                        }
                    });

                    api.tasks.on.displayed(scope, function(tasks, filteredTasks, visibleTasks) {
                        for (var i = 0, l = visibleTasks.length; i < l; i++) {
                            if (visibleTasks[i].overlaps) {
                                var task = visibleTasks[i];
                                task.$element.addClass(overlapCss);

                                if (scope.stackTasks) {
                                    applyStackLevel(task);
                                }
                            }
                        }
                    });
                }
            }
        };
    }]);
}());

angular.module('gantt.overlap.templates', []).run(['$templateCache', function($templateCache) {

}]);

//# sourceMappingURL=angular-gantt-overlap-plugin.js.map