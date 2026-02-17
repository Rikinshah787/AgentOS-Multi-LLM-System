#!/usr/bin/env python3
"""
Automated Progress Tracker for AgentOS
Tracks task completion and updates mission board
"""

import os
from datetime import datetime
import re

class ProgressTracker:
    def __init__(self):
        self.mission_board_path = "MISSION_BOARD.md"
        self.project_plan_path = "project-plan.md"
        self.metrics = {
            "tasks_completed": 0,
            "total_tasks": 0,
            "blockers_resolved": 0
        }

    def update_metrics(self):
        """Update progress metrics from mission board"""
        with open(self.mission_board_path, 'r') as f:
            content = f.read()

        # Count completed tasks
        completed = len(re.findall(r'- \[x\]', content))
        total = len(re.findall(r'- \[ \]', content)) + completed
        self.metrics["tasks_completed"] = completed
        self.metrics["total_tasks"] = total

        # Count resolved blockers
        self.metrics["blockers_resolved"] = len(re.findall(r'✅', content))

        return self.metrics

    def generate_report(self):
        """Generate progress report"""
        metrics = self.update_metrics()
        report = f"""
📊 PROGRESS REPORT - {datetime.now().strftime('%Y-%m-%d')}
----------------------------------------
Tasks Completed: {metrics['tasks_completed']}/{metrics['total_tasks']}
Completion Rate: {metrics['tasks_completed']/metrics['total_tasks']*100:.1f}%
Blockers Resolved: {metrics['blockers_resolved']}

🔍 Next Steps:
1. Review pending tasks in MISSION_BOARD.md
2. Address any new blockers
3. Update project plan accordingly
"""
        return report

    def update_mission_board(self):
        """Update mission board with current metrics"""
        with open(self.mission_board_path, 'r') as f:
            content = f.read()

        metrics = self.update_metrics()
        new_content = re.sub(
            r'Tasks completed this week: \d+/\d+',
            f'Tasks completed this week: {metrics["tasks_completed"]}/{metrics["total_tasks"]}',
            content
        )

        with open(self.mission_board_path, 'w') as f:
            f.write(new_content)

        print("✅ Mission board updated with current metrics")

if __name__ == "__main__":
    tracker = ProgressTracker()
    print(tracker.generate_report())
    tracker.update_mission_board()