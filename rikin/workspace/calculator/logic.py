class Calculator:
    def __init__(self):
        self.reset()

    def reset(self):
        self.current_value = 0
        self.previous_value = None
        self.operation = None
        self.history = []

    def calculate(self, a, op, b):
        if op == "+":
            return a + b
        elif op == "-":
            return a - b
        elif op == "*":
            return a * b
        elif op == "/":
            if b == 0:
                raise ValueError("Cannot divide by zero!")
            return a / b
        else:
            raise ValueError(f"Unknown operation: {op}")

    def apply_operation(self, num, op=None):
        if op:
            if self.operation:  # Chain operations (e.g., 3 + 5 * 2)
                self.current_value = self.calculate(self.current_value, self.operation, num)
            else:
                self.current_value = num
            self.operation = op
        else:
            if self.operation:  # Final calculation (e.g., 3 + 5 =)
                self.current_value = self.calculate(self.current_value, self.operation, num)
                self.operation = None
        self.history.append(f"{self.current_value} {op if op else '='} {num}")
        return self.current_value