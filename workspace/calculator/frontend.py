"""
Calculator Frontend (GUI)
A simple tkinter-based calculator interface
"""

import tkinter as tk
from tkinter import messagebox
from logic import CalculatorLogic

class CalculatorGUI:
    """Graphical calculator using tkinter."""
    
    def __init__(self):
        self.calc = CalculatorLogic()
        self.root = tk.Tk()
        self.root.title("🧮 AgentOS Calculator")
        self.root.geometry("320x450")
        self.root.resizable(False, False)
        self.root.configure(bg="#2b2b2b")
        
        self.current_input = ""
        self.setup_ui()
    
    def setup_ui(self):
        """Create the calculator UI."""
        # Display
        self.display_var = tk.StringVar(value="0")
        display = tk.Entry(
            self.root, 
            textvariable=self.display_var,
            font=("Consolas", 28),
            justify="right",
            bd=0,
            bg="#1a1a1a",
            fg="#00ff88"
        )
        display.pack(fill="x", padx=10, pady=10, ipady=15)
        
        # Button frame
        btn_frame = tk.Frame(self.root, bg="#2b2b2b")
        btn_frame.pack(expand=True, fill="both", padx=10, pady=5)
        
        # Button layout
        buttons = [
            ["C", "⌫", "%", "÷"],
            ["7", "8", "9", "×"],
            ["4", "5", "6", "-"],
            ["1", "2", "3", "+"],
            ["√", "0", ".", "="]
        ]
        
        for row_idx, row in enumerate(buttons):
            for col_idx, btn_text in enumerate(row):
                btn = tk.Button(
                    btn_frame,
                    text=btn_text,
                    font=("Arial", 18, "bold"),
                    bd=0,
                    bg="#3c3c3c" if btn_text not in ["=", "C"] else "#ff6b35" if btn_text == "=" else "#ff4757",
                    fg="white",
                    activebackground="#4a4a4a",
                    command=lambda t=btn_text: self.on_button_click(t)
                )
                btn.grid(row=row_idx, column=col_idx, sticky="nsew", padx=3, pady=3, ipadx=10, ipady=15)
                btn_frame.grid_columnconfigure(col_idx, weight=1)
            btn_frame.grid_rowconfigure(row_idx, weight=1)
    
    def on_button_click(self, button: str):
        """Handle button clicks."""
        if button in "0123456789":
            self.current_input += button
            self.display_var.set(self.current_input)
        
        elif button == ".":
            if "." not in self.current_input.split("+")[-1].split("-")[-1].split("×")[-1].split("÷")[-1]:
                self.current_input += "."
                self.display_var.set(self.current_input)
        
        elif button in ["+", "-", "×", "÷"]:
            self.current_input += f" {button} "
            self.display_var.set(self.current_input)
        
        elif button == "=":
            self.calculate()
        
        elif button == "C":
            self.current_input = ""
            self.display_var.set("0")
        
        elif button == "⌫":
            self.current_input = self.current_input[:-1]
            self.display_var.set(self.current_input if self.current_input else "0")
        
        elif button == "%":
            try:
                val = float(self.current_input) / 100
                self.current_input = str(val)
                self.display_var.set(self.current_input)
            except:
                pass
        
        elif button == "√":
            try:
                val = self.calc.sqrt(float(self.current_input))
                self.current_input = str(val)
                self.display_var.set(self.current_input)
            except Exception as e:
                messagebox.showerror("Error", str(e))
    
    def calculate(self):
        """Evaluate the current expression."""
        try:
            expr = self.current_input.replace("×", "*").replace("÷", "/")
            result = eval(expr)
            self.display_var.set(result)
            self.current_input = str(result)
        except ZeroDivisionError:
            messagebox.showerror("Error", "Cannot divide by zero!")
            self.current_input = ""
            self.display_var.set("0")
        except Exception as e:
            messagebox.showerror("Error", f"Invalid expression: {e}")
    
    def run(self):
        """Start the calculator."""
        self.root.mainloop()


if __name__ == "__main__":
    app = CalculatorGUI()
    app.run()