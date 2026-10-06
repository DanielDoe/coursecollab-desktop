/** Worked solutions for live classroom questions. Students see these only after unlock. */
export const CLASSROOM_WORKED_SOLUTIONS: Record<string, string> = {
  "Account Minimum Balance Check": `#include <iostream>
using namespace std;

int main() {
    double balance;
    cout << "Enter account balance: ";
    cin >> balance;
    cout << (balance >= 500 ? "Minimum Balance Met" : "Below Minimum Balance") << endl;
    return 0;
}`,
  "Area of a Circle": `#include <iostream>
using namespace std;

int main() {
    double radius;
    cout << "Enter the radius: ";
    cin >> radius;
    double area = 3.14159 * radius * radius;
    cout << "Area of the circle: " << area << endl;
    return 0;
}`,
  "Battery Low Warning System": `#include <iostream>
using namespace std;

int main() {
    double battery;
    cout << "Enter battery percentage: ";
    cin >> battery;
    if (battery <= 20) {
        cout << "Warning: Battery is low." << endl;
    } else {
        cout << "Battery level is sufficient." << endl;
    }
    return 0;
}`,
  "Celsius to Fahrenheit": `#include <iostream>
using namespace std;

int main() {
    double celsius;
    cout << "Enter temperature in Celsius: ";
    cin >> celsius;
    double fahrenheit = (9.0 / 5.0) * celsius + 32;
    cout << "Temperature in Fahrenheit: " << fahrenheit << endl;
    return 0;
}`,
  "Check if a Number is Positive or Negative": `#include <iostream>
using namespace std;

int main() {
    double number;
    cout << "Enter a number: ";
    cin >> number;
    if (number >= 0) {
        cout << "Positive Number" << endl;
    } else {
        cout << "Negative Number" << endl;
    }
    return 0;
}`,
  "Discount Calculation Based on Total Bill": `#include <iostream>
using namespace std;

int main() {
    double bill;
    cout << "Enter total bill: ";
    cin >> bill;
    if (bill > 100) {
        bill = bill * 0.90;
    }
    cout << "Final bill: $" << bill << endl;
    return 0;
}`,
  "Electricity Bill Calculator (Tiered Pricing)": `#include <iostream>
#include <iomanip>
using namespace std;

int main() {
    double kwh, bill;
    cout << "Enter electricity usage (kWh): ";
    cin >> kwh;
    if (kwh <= 500) {
        bill = kwh * 0.12;
    } else {
        bill = 500 * 0.12 + (kwh - 500) * 0.18;
    }
    cout << fixed << setprecision(2);
    cout << "Electricity Bill: $" << bill << endl;
    return 0;
}`,
  "Electricity Cost Calculator": `#include <iostream>
#include <iomanip>
using namespace std;

int main() {
    double watts, hours, rate;
    cout << "Enter power (watts): ";
    cin >> watts;
    cout << "Enter hours used: ";
    cin >> hours;
    cout << "Enter rate ($/kWh): ";
    cin >> rate;
    double energy = (watts * hours) / 1000;
    double cost = energy * rate;
    cout << fixed << setprecision(2);
    cout << "Energy Used: " << energy << " kWh" << endl;
    cout << "Operating Cost: $" << cost << endl;
    return 0;
}`,
  "Employee Salary with Overtime": `#include <iostream>
#include <iomanip>
using namespace std;

int main() {
    double hours, pay;
    cout << "Enter hours worked: ";
    cin >> hours;
    if (hours <= 40) {
        pay = hours * 20;
    } else {
        pay = 40 * 20 + (hours - 40) * 30;
    }
    cout << fixed << setprecision(2);
    cout << "Total Pay: $" << pay << endl;
    return 0;
}`,
  "Engineering Challenge — Kinetic Energy": `#include <iostream>
using namespace std;

int main() {
    double mass, velocity;
    cout << "Enter mass (kg): ";
    cin >> mass;
    cout << "Enter velocity (m/s): ";
    cin >> velocity;
    double energy = 0.5 * mass * velocity * velocity;
    cout << "Kinetic Energy: " << energy << " J" << endl;
    return 0;
}`,
  "Engineering Unit Converter Menu": `#include <iostream>
using namespace std;

int main() {
    int choice;
    double value;
    cout << "Select conversion (1-3): ";
    cin >> choice;
    cout << "Enter value: ";
    cin >> value;
    switch (choice) {
        case 1:
            cout << value * 100 << " centimeters" << endl;
            break;
        case 2:
            cout << value * 1000 << " grams" << endl;
            break;
        case 3:
            cout << value * 60 << " minutes" << endl;
            break;
        default:
            cout << "Invalid conversion" << endl;
            break;
    }
    return 0;
}`,
  "Even or Odd Number Checker": `#include <iostream>
using namespace std;

int main() {
    int number;
    cout << "Enter a number: ";
    cin >> number;
    if (number % 2 == 0) {
        cout << "Even Number" << endl;
    } else {
        cout << "Odd Number" << endl;
    }
    return 0;
}`,
  "Exam Final Grade with Attendance Rule": `#include <iostream>
using namespace std;

int main() {
    double exam, assignment, attendance, grade;
    cout << "Enter exam score: ";
    cin >> exam;
    cout << "Enter assignment score: ";
    cin >> assignment;
    cout << "Enter attendance percentage: ";
    cin >> attendance;
    grade = exam * 0.70 + assignment * 0.30;
    if (attendance < 75) {
        grade = grade - 10;
    }
    cout << "Final Grade: " << grade << endl;
    return 0;
}`,
  "Free Delivery Eligibility": `#include <iostream>
using namespace std;

int main() {
    double total;
    cout << "Enter order total: ";
    cin >> total;
    cout << (total >= 50 ? "Free Delivery" : "Delivery Charge Applies") << endl;
    return 0;
}`,
  "Gas Mileage Calculator": `#include <iostream>
using namespace std;

int main() {
    double miles, gallons;
    cout << "Miles traveled: ";
    cin >> miles;
    cout << "Gallons used: ";
    cin >> gallons;
    cout << "Fuel Efficiency: " << miles / gallons << " MPG" << endl;
    return 0;
}`,
  "Hourly Pay Calculator": `#include <iostream>
#include <iomanip>
using namespace std;

int main() {
    double hours, rate;
    cout << "Hours Worked: ";
    cin >> hours;
    cout << "Hourly Rate: $";
    cin >> rate;
    cout << fixed << setprecision(2);
    cout << "Total Pay: $" << hours * rate << endl;
    return 0;
}`,
  "Laboratory Equipment Access": `#include <iostream>
using namespace std;

int main() {
    int training, authorization;
    cout << "Safety training completed (1 = Yes, 0 = No): ";
    cin >> training;
    if (training == 1) {
        cout << "Instructor authorization (1 = Yes, 0 = No): ";
        cin >> authorization;
        if (authorization == 1) {
            cout << "Access Granted" << endl;
        } else {
            cout << "Access Denied: Instructor authorization required." << endl;
        }
    } else {
        cout << "Access Denied: Safety training required." << endl;
    }
    return 0;
}`,
  "Machine Temperature Status": `#include <iostream>
using namespace std;

int main() {
    double temperature;
    cout << "Enter machine temperature: ";
    cin >> temperature;
    cout << (temperature <= 80 ? "Normal Temperature" : "High Temperature") << endl;
    return 0;
}`,
  "Nested If — Exam Grade with Attendance Requirement": `#include <iostream>
using namespace std;

int main() {
    int exam, attendance;
    cin >> exam >> attendance;
    if (exam >= 60) {
        if (attendance >= 75) {
            cout << "Passed" << endl;
        } else {
            cout << "Failed: attendance" << endl;
        }
    } else {
        cout << "Failed: exam score" << endl;
    }
    return 0;
}`,
  "Nested If — Loan Approval with Income and Credit Score": `#include <iostream>
using namespace std;

int main() {
    double income;
    int credit;
    cin >> income >> credit;
    if (income >= 40000) {
        if (credit >= 650) {
            cout << "Approved" << endl;
        } else {
            cout << "Denied" << endl;
        }
    } else {
        cout << "Denied" << endl;
    }
    return 0;
}`,
  "Nested If — Shipping Cost with Weight and Destination": `#include <iostream>
using namespace std;

int main() {
    int destination;
    double weight, cost;
    cin >> destination >> weight;
    if (destination == 2) {
        if (weight <= 10) {
            cost = 25;
        } else {
            cost = 40;
        }
    } else {
        cost = 10;
    }
    cout << "Shipping Cost: $" << cost << endl;
    return 0;
}`,
  "Ohm's Law": `#include <iostream>
using namespace std;

int main() {
    double voltage, resistance;
    cout << "Enter voltage (V): ";
    cin >> voltage;
    cout << "Enter resistance (ohms): ";
    cin >> resistance;
    cout << "Current: " << voltage / resistance << " A" << endl;
    return 0;
}`,
  "Online Store Shipping, Discount, and Fraud Screening": `#include <iostream>
#include <iomanip>
#include <string>
using namespace std;

int main() {
    double subtotal;
    int membership, shipping, failed;
    cout << "Enter order subtotal: ";
    cin >> subtotal;
    cout << "Enter membership (0 None, 1 Silver, 2 Gold, 3 Platinum): ";
    cin >> membership;
    cout << "Enter shipping (1 Standard, 2 Express, 3 Overnight): ";
    cin >> shipping;
    cout << "Enter failed payment attempts: ";
    cin >> failed;

    if (subtotal <= 0 || failed < 0 || membership < 0 || membership > 3 || shipping < 1 || shipping > 3) {
        cout << "Invalid transaction" << endl;
        return 0;
    }
    if (failed >= 3) {
        cout << "BLOCKED" << endl;
        return 0;
    }

    double rate = 0;
    switch (membership) {
        case 1: rate = 0.05; break;
        case 2: rate = 0.10; break;
        case 3: rate = 0.15; break;
        default: rate = 0; break;
    }
    double discount = subtotal * rate;
    double discounted = subtotal - discount;
    double charge = 0;
    switch (shipping) {
        case 1: charge = 8; break;
        case 2: charge = 18; break;
        case 3: charge = 35; break;
    }
    if ((membership == 2 || membership == 3) && shipping == 1 && discounted >= 75) {
        charge = 0;
    }
    string status = discounted > 500 ? "MANUAL REVIEW" : "APPROVED";
    cout << fixed << setprecision(2);
    cout << "Membership Discount: $" << discount << endl;
    cout << "Final Shipping: $" << charge << endl;
    cout << "Final Total: $" << discounted + charge << endl;
    cout << "Order Status: " << status << endl;
    return 0;
}`,
  "Open Live Classroom — Fall 2026": `#include <iostream>
#include <string>
using namespace std;

int main() {
    string name;
    cout << "Enter your name: ";
    cin >> name;
    cout << "Welcome, " << name << "!" << endl;
    return 0;
}`,
  "Package Weight Surcharge": `#include <iostream>
#include <iomanip>
using namespace std;

int main() {
    double weight, cost = 8;
    cout << "Enter package weight (kg): ";
    cin >> weight;
    if (weight > 20) {
        cost = cost + 12;
    }
    cout << fixed << setprecision(2);
    cout << "Shipping Cost: $" << cost << endl;
    return 0;
}`,
  "Parking Garage Rate Selector": `#include <iostream>
using namespace std;

int main() {
    int vehicle;
    cout << "Enter vehicle type (1-4): ";
    cin >> vehicle;
    switch (vehicle) {
        case 1: cout << "Parking Fee: $5" << endl; break;
        case 2: cout << "Parking Fee: $10" << endl; break;
        case 3: cout << "Parking Fee: $15" << endl; break;
        case 4: cout << "Parking Fee: $20" << endl; break;
        default: cout << "Invalid vehicle type" << endl; break;
    }
    return 0;
}`,
  "Perimeter of a Rectangle": `#include <iostream>
using namespace std;

int main() {
    double length, width;
    cout << "Enter length: ";
    cin >> length;
    cout << "Enter width: ";
    cin >> width;
    cout << "Perimeter: " << 2 * (length + width) << endl;
    return 0;
}`,
  "Restaurant Bill Splitter": `#include <iostream>
#include <iomanip>
using namespace std;

int main() {
    double bill, tipPercent, people;
    cin >> bill >> tipPercent >> people;
    double tip = bill * tipPercent / 100;
    double total = bill + tip;
    cout << fixed << setprecision(2);
    cout << "Tip: $" << tip << endl;
    cout << "Total Bill: $" << total << endl;
    cout << "Amount Per Person: $" << total / people << endl;
    return 0;
}`,
  "Restaurant Order and Delivery Charge": `#include <iostream>
#include <iomanip>
#include <string>
using namespace std;

int main() {
    int meal, quantity, delivery;
    cin >> meal >> quantity >> delivery;
    if (meal < 1 || meal > 3 || quantity <= 0) {
        cout << "Invalid order" << endl;
        return 0;
    }
    double price = 0;
    switch (meal) {
        case 1: price = 8.50; break;
        case 2: price = 12.00; break;
        case 3: price = 10.00; break;
    }
    double subtotal = price * quantity;
    double charge = 0;
    if (delivery == 1 && subtotal < 30) {
        charge = 5;
    }
    string type = delivery == 1 ? "DELIVERY" : "PICKUP";
    cout << fixed << setprecision(2);
    cout << "Order Type: " << type << endl;
    cout << "Food Subtotal: $" << subtotal << endl;
    cout << "Delivery Charge: $" << charge << endl;
    cout << "Final Total: $" << subtotal + charge << endl;
    return 0;
}`,
  "Ride Fare Calculation with Surge Pricing": `#include <iostream>
#include <iomanip>
using namespace std;

int main() {
    double miles;
    cout << "Enter distance traveled (miles): ";
    cin >> miles;
    double fare = 3 + miles * 2;
    if (miles > 10) {
        fare = fare * 1.20;
    }
    cout << fixed << setprecision(2);
    cout << "Final Fare: $" << fare << endl;
    return 0;
}`,
  "Shopping Discount Calculator": `#include <iostream>
#include <iomanip>
using namespace std;

int main() {
    double price, percent;
    cin >> price >> percent;
    double discount = price * percent / 100;
    cout << fixed << setprecision(2);
    cout << "Original Price: $" << price << endl;
    cout << "Discount: $" << discount << endl;
    cout << "Final Price: $" << price - discount << endl;
    return 0;
}`,
  "Shopping Discount with Minimum Purchase": `#include <iostream>
#include <iomanip>
using namespace std;

int main() {
    double amount, rate = 0;
    cout << "Enter purchase amount: ";
    cin >> amount;
    if (amount > 200) {
        rate = 0.15;
    } else if (amount >= 100) {
        rate = 0.10;
    }
    double discount = amount * rate;
    cout << fixed << setprecision(2);
    cout << "Discount: $" << discount << endl;
    cout << "Final Price: $" << amount - discount << endl;
    return 0;
}`,
  "Smart Home Device Controller": `#include <iostream>
using namespace std;

int main() {
    int device;
    cout << "Select device (1-4): ";
    cin >> device;
    switch (device) {
        case 1: cout << "Living Room Lights Selected" << endl; break;
        case 2: cout << "Air Conditioner Selected" << endl; break;
        case 3: cout << "Security System Selected" << endl; break;
        case 4: cout << "Garage Door Selected" << endl; break;
        default: cout << "Invalid device selection" << endl; break;
    }
    return 0;
}`,
  "Student Grade Average": `#include <iostream>
#include <iomanip>
using namespace std;

int main() {
    double a, b, c;
    cout << "Exam 1: ";
    cin >> a;
    cout << "Exam 2: ";
    cin >> b;
    cout << "Exam 3: ";
    cin >> c;
    cout << fixed << setprecision(2);
    cout << "Average: " << (a + b + c) / 3.0 << endl;
    return 0;
}`,
  "Student Movie Ticket Price": `#include <iostream>
using namespace std;

int main() {
    int age;
    cin >> age;
    if (age < 0) {
        cout << "INVALID AGE" << endl;
    } else if (age <= 12) {
        cout << "Ticket Price: $6" << endl;
    } else if (age <= 64) {
        cout << "Ticket Price: $10" << endl;
    } else {
        cout << "Ticket Price: $7" << endl;
    }
    return 0;
}`,
  "Switch — ATM Transaction Menu": `#include <iostream>
using namespace std;

int main() {
    int choice;
    cin >> choice;
    switch (choice) {
        case 1: cout << "Check Balance" << endl; break;
        case 2: cout << "Withdraw Money" << endl; break;
        case 3: cout << "Deposit Money" << endl; break;
        default: cout << "Invalid transaction" << endl; break;
    }
    return 0;
}`,
  "Switch — Cafeteria Meal Price": `#include <iostream>
using namespace std;

int main() {
    int meal;
    cin >> meal;
    switch (meal) {
        case 1: cout << "Breakfast: $5.50" << endl; break;
        case 2: cout << "Lunch: $8.75" << endl; break;
        case 3: cout << "Dinner: $10.25" << endl; break;
        default: cout << "Invalid meal" << endl; break;
    }
    return 0;
}`,
  "Switch — Mobile Data Plans": `#include <iostream>
using namespace std;

int main() {
    char plan;
    cin >> plan;
    switch (plan) {
        case 'B': cout << "Basic: $30" << endl; break;
        case 'S': cout << "Standard: $50" << endl; break;
        case 'P': cout << "Premium: $70" << endl; break;
        default: cout << "Invalid plan" << endl; break;
    }
    return 0;
}`,
  "Temperature Checker": `#include <iostream>
using namespace std;

int main() {
    double temperature;
    cout << "Enter temperature: ";
    cin >> temperature;
    if (temperature > 30) {
        cout << "It's hot outside." << endl;
    } else {
        cout << "It's cool outside." << endl;
    }
    return 0;
}`,
  "Ternary — Extra Data Charge": `#include <iostream>
using namespace std;

int main() {
    int used;
    cin >> used;
    int extra = used > 10 ? used - 10 : 0;
    cout << "Extra Charge: $" << extra * 10 << endl;
    return 0;
}`,
  "Ternary — Passing Score": `#include <iostream>
#include <string>
using namespace std;

int main() {
    int score;
    cin >> score;
    string result = score >= 60 ? "Passed" : "Failed";
    cout << result << endl;
    return 0;
}`,
  "Total Purchase Cost": `#include <iostream>
#include <iomanip>
using namespace std;

int main() {
    double price, quantity;
    cin >> price >> quantity;
    double subtotal = price * quantity;
    double tax = subtotal * 0.0825;
    cout << fixed << setprecision(2);
    cout << "Subtotal: $" << subtotal << endl;
    cout << "Tax: $" << tax << endl;
    cout << "Total: $" << subtotal + tax << endl;
    return 0;
}`,
  "University Scholarship Eligibility": `#include <iostream>
using namespace std;

int main() {
    double gpa;
    int credits;
    cin >> gpa >> credits;
    if (gpa < 0.0 || gpa > 4.0 || credits < 0) {
        cout << "INVALID DATA" << endl;
    } else if (gpa >= 3.75 && credits >= 60) {
        cout << "FULL SCHOLARSHIP" << endl;
    } else if (gpa >= 3.25 && credits >= 30) {
        cout << "PARTIAL SCHOLARSHIP" << endl;
    } else {
        cout << "NOT ELIGIBLE" << endl;
    }
    return 0;
}`,
  "Vehicle Rental Eligibility": `#include <iostream>
using namespace std;

int main() {
    int age, license;
    cout << "Enter age: ";
    cin >> age;
    if (age >= 21) {
        cout << "Valid driver's license (1 = Yes, 0 = No): ";
        cin >> license;
        if (license == 1) {
            cout << "Vehicle Rental Approved" << endl;
        } else {
            cout << "Vehicle Rental Denied: Valid license required." << endl;
        }
    } else {
        cout << "Vehicle Rental Denied: Must be at least 21." << endl;
    }
    return 0;
}`,
  "Voting Eligibility": `#include <iostream>
using namespace std;

int main() {
    int age;
    cout << "Enter your age: ";
    cin >> age;
    if (age >= 18) {
        cout << "Eligible to vote." << endl;
    } else {
        cout << "Not eligible to vote." << endl;
    }
    return 0;
}`,
  "Warehouse Package Acceptance": `#include <iostream>
using namespace std;

int main() {
    double weight;
    int label;
    cout << "Enter package weight (kg): ";
    cin >> weight;
    if (weight <= 50) {
        cout << "Valid shipping label (1 = Yes, 0 = No): ";
        cin >> label;
        if (label == 1) {
            cout << "Package Accepted" << endl;
        } else {
            cout << "Package Rejected: Invalid shipping label." << endl;
        }
    } else {
        cout << "Package Rejected: Weight limit exceeded." << endl;
    }
    return 0;
}`,
  "Water Tank Safety Alert": `#include <iostream>
using namespace std;

int main() {
    double liters;
    cout << "Enter water level (liters): ";
    cin >> liters;
    if (liters > 900) {
        cout << "Warning: Water level exceeds safe limit." << endl;
    } else {
        cout << "Water level is safe." << endl;
    }
    return 0;
}`,
  "ATM Withdrawal Approval": `#include <iostream>
using namespace std;

int main() {
    double balance, limit, amount;
    cout << "Enter account balance: ";
    cin >> balance;
    cout << "Enter daily limit: ";
    cin >> limit;
    cout << "Enter withdrawal amount: ";
    cin >> amount;
    if (amount > balance) {
        cout << "Denied" << endl;
    } else if (amount > limit) {
        cout << "Denied" << endl;
    } else {
        cout << "Approved" << endl;
    }
    return 0;
}`,
  "Classroom Points: Apply Discount to Purchases (Array)": `#include <iostream>
using namespace std;

int main() {
    double purchases[5];
    for (int i = 0; i < 5; i++) {
        cout << "Enter purchase " << i + 1 << ": ";
        cin >> purchases[i];
    }
    for (int i = 0; i < 5; i++) {
        double discounted = purchases[i] >= 100 ? purchases[i] * 0.90 : purchases[i];
        cout << "Original price: " << purchases[i] << endl;
        cout << "Discounted price: " << discounted << endl;
    }
    return 0;
}`,
  "Classroom Points: Average of Three Numbers": `#include <iostream>
using namespace std;

double calculateAverage(double a, double b, double c) {
    return (a + b + c) / 3.0;
}

int main() {
    double a, b, c;
    cout << "Enter three values: ";
    cin >> a >> b >> c;
    cout << "Average: " << calculateAverage(a, b, c) << endl;
    return 0;
}`,
  "Classroom Points: Basic Pointer Value": `#include <iostream>
using namespace std;

int main() {
    int value = 10;
    int* ptr = &value;
    cout << "Value: " << value << endl;
    cout << "Address: " << ptr << endl;
    cout << "Value through pointer: " << *ptr << endl;
    return 0;
}`,
  "Classroom Points: Calculate Average Score (Array)": `#include <iostream>
using namespace std;

int main() {
    double scores[6];
    double total = 0;
    for (int i = 0; i < 6; i++) {
        cout << "Enter score " << i + 1 << ": ";
        cin >> scores[i];
        total = total + scores[i];
    }
    cout << "Total: " << total << endl;
    cout << "Average: " << total / 6 << endl;
    return 0;
}`,
  "Classroom Points: Count Passing Students (Array)": `#include <iostream>
using namespace std;

int main() {
    double scores[10];
    int passing = 0;
    int failing = 0;
    for (int i = 0; i < 10; i++) {
        cout << "Enter score " << i + 1 << ": ";
        cin >> scores[i];
        if (scores[i] >= 60) passing++;
        else failing++;
    }
    cout << "Passing: " << passing << endl;
    cout << "Failing: " << failing << endl;
    return 0;
}`,
  "Classroom Points: Find Maximum Using Pointer": `#include <iostream>
using namespace std;

int findMax(int* ptr, int size) {
    int maximum = ptr[0];
    for (int i = 1; i < size; i++) {
        if (*(ptr + i) > maximum) maximum = *(ptr + i);
    }
    return maximum;
}

int main() {
    int numbers[5];
    for (int i = 0; i < 5; i++) {
        cout << "Enter number " << i + 1 << ": ";
        cin >> numbers[i];
    }
    cout << "Maximum: " << findMax(numbers, 5) << endl;
    return 0;
}`,
  "Classroom Points: Find the Largest Number (Array)": `#include <iostream>
using namespace std;

int main() {
    int numbers[5];
    for (int i = 0; i < 5; i++) {
        cout << "Enter number " << i + 1 << ": ";
        cin >> numbers[i];
    }
    int largest = numbers[0];
    for (int i = 1; i < 5; i++) {
        if (numbers[i] > largest) largest = numbers[i];
    }
    cout << "Largest: " << largest << endl;
    return 0;
}`,
  "Classroom Points: Loan Eligibility Function": `#include <iostream>
using namespace std;

bool isApproved(double income, int creditScore) {
    return (income >= 40000 && creditScore >= 650) || income >= 60000;
}

int main() {
    double income;
    int credit;
    cout << "Enter income: ";
    cin >> income;
    cout << "Enter credit score: ";
    cin >> credit;
    if (isApproved(income, credit)) cout << "Approved" << endl;
    else cout << "Denied" << endl;
    return 0;
}`,
  "Classroom Points: Modify Value Using Pointer": `#include <iostream>
using namespace std;

int main() {
    int value = 10;
    int* ptr = &value;
    *ptr = 25;
    cout << "Updated value: " << value << endl;
    return 0;
}`,
  "Classroom Points: Rectangle Area Function": `#include <iostream>
using namespace std;

double calculateArea(double length, double width) {
    return length * width;
}

int main() {
    double length, width;
    cout << "Enter length and width: ";
    cin >> length >> width;
    cout << "Area: " << calculateArea(length, width) << endl;
    return 0;
}`,
  "Classroom Points: Sales Tax Function": `#include <iostream>
using namespace std;

double calculateFinalPrice(double price, double taxRate) {
    return price + (price * taxRate / 100);
}

int main() {
    double price, taxRate;
    cout << "Enter original price: ";
    cin >> price;
    cout << "Enter tax rate: ";
    cin >> taxRate;
    cout << "Final price: " << calculateFinalPrice(price, taxRate) << endl;
    return 0;
}`,
  "Classroom Points: Speed Category Function": `#include <iostream>
#include <string>
using namespace std;

string checkSpeed(int speed) {
    if (speed <= 70) return "Safe";
    if (speed <= 85) return "Warning";
    return "Violation";
}

int main() {
    int speed;
    cout << "Enter speed: ";
    cin >> speed;
    cout << checkSpeed(speed) << endl;
    return 0;
}`,
  "Classroom Points: Speed Violations Counter (Array)": `#include <iostream>
using namespace std;

int main() {
    double speeds[8];
    int violations = 0;
    for (int i = 0; i < 8; i++) {
        cout << "Enter speed " << i + 1 << ": ";
        cin >> speeds[i];
        if (speeds[i] > 70) violations++;
    }
    cout << "Violations: " << violations << endl;
    return 0;
}`,
  "Classroom Points: Sum of Array Using Pointer Arithmetic": `#include <iostream>
using namespace std;

int calculateSum(int* ptr, int size) {
    int total = 0;
    for (int i = 0; i < size; i++) {
        total = total + *(ptr + i);
    }
    return total;
}

int main() {
    int numbers[6];
    for (int i = 0; i < 6; i++) {
        cout << "Enter number " << i + 1 << ": ";
        cin >> numbers[i];
    }
    cout << "Sum: " << calculateSum(numbers, 6) << endl;
    return 0;
}`,
  "Classroom Points: Swap Two Numbers Using Pointers": `#include <iostream>
using namespace std;

void swapValues(int* first, int* second) {
    int temp = *first;
    *first = *second;
    *second = temp;
}

int main() {
    int a, b;
    cout << "Enter two numbers: ";
    cin >> a >> b;
    swapValues(&a, &b);
    cout << a << " " << b << endl;
    return 0;
}`,
  "Electricity Bill With Tiered Rates": `#include <iostream>
#include <iomanip>
using namespace std;

int main() {
    double kwh, bill;
    cout << "Enter total kWh used: ";
    cin >> kwh;
    if (kwh <= 500) {
        bill = kwh * 0.12;
    } else if (kwh <= 1000) {
        bill = 500 * 0.12 + (kwh - 500) * 0.15;
    } else {
        bill = 500 * 0.12 + 500 * 0.15 + (kwh - 1000) * 0.20;
    }
    cout << fixed << setprecision(2);
    cout << "Total bill: $" << bill << endl;
    return 0;
}`,
  "Loan Approval System": `#include <iostream>
using namespace std;

int main() {
    double income;
    int credit;
    cout << "Enter income: ";
    cin >> income;
    cout << "Enter credit score: ";
    cin >> credit;
    if (income >= 40000 && credit >= 650) {
        cout << "Approved" << endl;
    } else if (income >= 60000) {
        cout << "Approved" << endl;
    } else {
        cout << "Denied" << endl;
    }
    return 0;
}`,
  "Movie Ticket Pricing (Switch Statement)": `#include <iostream>
using namespace std;

int main() {
    char type;
    cout << "Enter ticket type (C, S, A, R): ";
    cin >> type;
    switch (type) {
        case 'C': cout << "Ticket price: $6" << endl; break;
        case 'S': cout << "Ticket price: $8" << endl; break;
        case 'A': cout << "Ticket price: $12" << endl; break;
        case 'R': cout << "Ticket price: $7" << endl; break;
        default: cout << "Invalid ticket type" << endl; break;
    }
    return 0;
}`,
  "Phone Plan Billing (Ternary Operator Required)": `#include <iostream>
using namespace std;

int main() {
    double used;
    cout << "Enter data used (GB): ";
    cin >> used;
    double extra = used > 10 ? (used - 10) * 10 : 0;
    cout << "Extra data cost: $" << extra << endl;
    return 0;
}`,
  "Shipping Cost Calculator": `#include <iostream>
using namespace std;

int main() {
    double weight;
    int destination;
    cout << "Enter package weight: ";
    cin >> weight;
    cout << "Enter destination (1 domestic, 2 international): ";
    cin >> destination;
    double cost = 10;
    if (weight > 20) {
        cost = cost + 15;
    }
    if (destination == 2) {
        cost = cost + 25;
    }
    cout << "Shipping cost: $" << cost << endl;
    return 0;
}`,
  "simple interest calculation": `#include <iostream>
using namespace std;

int main() {
    double principal, rate, time;
    cout << "Enter principal, rate, and time: ";
    cin >> principal >> rate >> time;
    double interest = (principal * rate * time) / 100;
    cout << "Simple interest: " << interest << endl;
    return 0;
}`,
  "✅ Count Positive Numbers": `#include <iostream>
using namespace std;

int main() {
    int number = 0;
    int count = 0;
    cout << "Enter a number (-1 to stop): ";
    cin >> number;
    while (number != -1) {
        if (number > 0) count++;
        cout << "Enter a number (-1 to stop): ";
        cin >> number;
    }
    cout << "Positive numbers: " << count << endl;
    return 0;
}`,
  "✅ Password Retry System": `#include <iostream>
#include <string>
using namespace std;

int main() {
    string password = "";
    while (password != "1234") {
        cout << "Enter password: ";
        cin >> password;
    }
    cout << "Access Granted" << endl;
    return 0;
}`,
  "✅ Simple Bank Balance Growth": `#include <iostream>
#include <iomanip>
using namespace std;

int main() {
    double balance;
    int years = 0;
    cout << "Enter starting balance: ";
    cin >> balance;
    while (balance < 10000) {
        balance = balance * 1.05;
        years++;
    }
    cout << fixed << setprecision(2);
    cout << "Years: " << years << endl;
    cout << "Final balance: $" << balance << endl;
    return 0;
}`,
  "✅ Sum Until User Enters 0": `#include <iostream>
using namespace std;

int main() {
    double number = 0;
    double total = 0;
    cout << "Enter a number (0 to stop): ";
    cin >> number;
    while (number != 0) {
        total = total + number;
        cout << "Enter a number (0 to stop): ";
        cin >> number;
    }
    cout << "Total: " << total << endl;
    return 0;
}`,
  "✅ Track Largest Number": `#include <iostream>
using namespace std;

int main() {
    double number, largest;
    cout << "Enter a number (0 to stop): ";
    cin >> number;
    largest = number;
    while (number != 0) {
        if (number > largest) largest = number;
        cout << "Enter a number (0 to stop): ";
        cin >> number;
    }
    cout << "Largest: " << largest << endl;
    return 0;
}`,
  "➕ Sum Until Zero": `#include <iostream>
using namespace std;

int main() {
    double number, total = 0;
    do {
        cout << "Enter a number (0 to stop): ";
        cin >> number;
        total = total + number;
    } while (number != 0);
    cout << "Total: " << total << endl;
    return 0;
}`,
  "⭐ Star Square Pattern": `#include <iostream>
using namespace std;

int main() {
    int n;
    cout << "Enter n: ";
    cin >> n;
    for (int row = 0; row < n; row++) {
        for (int col = 0; col < n; col++) {
            cout << "*";
        }
        cout << endl;
    }
    return 0;
}`,
  "🌡 Temperature Average": `#include <iostream>
using namespace std;

int main() {
    double temperature, total = 0;
    for (int day = 1; day <= 5; day++) {
        cout << "Enter temperature " << day << ": ";
        cin >> temperature;
        total = total + temperature;
    }
    cout << "Average: " << total / 5 << endl;
    return 0;
}`,
  "🎓 Counting Passing Scores": `#include <iostream>
using namespace std;

int main() {
    int score, passing = 0;
    for (int i = 0; i < 10; i++) {
        cout << "Enter score: ";
        cin >> score;
        if (score >= 60) passing++;
    }
    cout << "Passing scores: " << passing << endl;
    return 0;
}`,
  "🏦 ATM PIN with Limited Attempts": `#include <iostream>
#include <string>
using namespace std;

int main() {
    string pin;
    int attempts = 0;
    bool approved = false;
    do {
        cout << "Enter PIN: ";
        cin >> pin;
        attempts++;
        if (pin == "5678") approved = true;
    } while (!approved && attempts < 3);
    if (approved) cout << "Approved" << endl;
    else cout << "Card Locked" << endl;
    return 0;
}`,
  "🏦 Loan Payment Simulation": `#include <iostream>
#include <iomanip>
using namespace std;

int main() {
    double balance, payment;
    cout << "Enter starting balance: ";
    cin >> balance;
    cout << "Enter monthly payment: ";
    cin >> payment;
    cout << fixed << setprecision(2);
    for (int month = 1; month <= 12 && balance > 0; month++) {
        if (payment > balance) balance = 0;
        else balance = balance - payment;
        cout << "Month " << month << ": $" << balance << endl;
    }
    return 0;
}`,
  "💰 Savings Growth": `#include <iostream>
#include <iomanip>
using namespace std;

int main() {
    double balance;
    cout << "Enter starting balance: ";
    cin >> balance;
    cout << fixed << setprecision(2);
    for (int year = 1; year <= 5; year++) {
        balance = balance * 1.05;
        cout << "Year " << year << ": $" << balance << endl;
    }
    return 0;
}`,
  "📈 Stock Growth With Conditional Bonus": `#include <iostream>
#include <iomanip>
using namespace std;

int main() {
    double balance;
    cout << "Enter starting balance: ";
    cin >> balance;
    cout << fixed << setprecision(2);
    for (int year = 1; year <= 6; year++) {
        balance = balance * 1.08;
        if (balance > 10000) balance = balance + 500;
        cout << "Year " << year << ": $" << balance << endl;
    }
    return 0;
}`,
  "📊 Classroom Seating Chart": `#include <iostream>
using namespace std;

int main() {
    int seat = 1;
    for (int row = 1; row <= 4; row++) {
        cout << "Row " << row << ":";
        for (int col = 1; col <= 6; col++) {
            cout << " " << seat;
            seat++;
        }
        cout << endl;
    }
    return 0;
}`,
  "📊 Highest Daily Sales": `#include <iostream>
using namespace std;

int main() {
    double sales, highest;
    cout << "Enter sales for day 1: ";
    cin >> sales;
    highest = sales;
    for (int day = 2; day <= 6; day++) {
        cout << "Enter sales for day " << day << ": ";
        cin >> sales;
        if (sales > highest) highest = sales;
    }
    cout << "Highest: " << highest << endl;
    return 0;
}`,
  "📊 Highest Value Tracker": `#include <iostream>
using namespace std;

int main() {
    double number, highest;
    cout << "Enter a number (-1 to stop): ";
    cin >> number;
    highest = number;
    do {
        if (number > highest) highest = number;
        cout << "Enter a number (-1 to stop): ";
        cin >> number;
    } while (number != -1);
    cout << "Highest: " << highest << endl;
    return 0;
}`,
  "🔐 Password Check": `#include <iostream>
#include <string>
using namespace std;

int main() {
    string password;
    do {
        cout << "Enter password: ";
        cin >> password;
    } while (password != "1234");
    cout << "Access Granted" << endl;
    return 0;
}`,
  "🔢 Multiplication Table (1–5)": `#include <iostream>
using namespace std;

int main() {
    for (int row = 1; row <= 5; row++) {
        for (int col = 1; col <= 5; col++) {
            cout << row * col << " ";
        }
        cout << endl;
    }
    return 0;
}`,
  "🔺 Increasing Triangle": `#include <iostream>
using namespace std;

int main() {
    int n;
    cout << "Enter n: ";
    cin >> n;
    for (int row = 1; row <= n; row++) {
        for (int col = 1; col <= row; col++) {
            cout << "*";
            if (col < row) cout << " ";
        }
        cout << endl;
    }
    return 0;
}`,
  "🚗 Highway Speed Violation Tracker": `#include <iostream>
using namespace std;

int main() {
    double speed, violatorTotal = 0;
    int violations = 0;
    for (int i = 1; i <= 12; i++) {
        cout << "Enter speed " << i << ": ";
        cin >> speed;
        if (speed > 70) {
            violations++;
            violatorTotal = violatorTotal + speed;
        }
    }
    if (violations == 0) {
        cout << "No violations" << endl;
    } else {
        cout << "Violations: " << violations << endl;
        cout << "Average violator speed: " << violatorTotal / violations << endl;
    }
    return 0;
}`,
  "🧾 Weekly Expense Tracker": `#include <iostream>
using namespace std;

int main() {
    double expense, total = 0;
    for (int day = 1; day <= 7; day++) {
        cout << "Enter expense for day " << day << ": ";
        cin >> expense;
        total = total + expense;
    }
    cout << "Total spending: " << total << endl;
    return 0;
}`,
  "Classroom Points (MATLAB): Basic Function — Single Input, Single Output": `function result = squareValue(number)
    result = number ^ 2;
end`,
  "Classroom Points (MATLAB): Basic Plot of Given Data": `x = [1 2 3 4 5];
y = [2 4 6 8 10];
plot(x, y)
title('Given data')
xlabel('x')
ylabel('y')
grid on`,
  "Classroom Points (MATLAB): Element-by-Element Operations": `x = [1 2 3];
y = [4 5 6];
disp(x .* y)
disp(x ./ y)
disp(x .^ 2)
% x^2 tries matrix multiplication and fails for a row vector.
% x.^2 squares each element.`,
  "Classroom Points (MATLAB): Flow Control — If Statement": `number = input('Enter a number: ');
if number > 0
    disp("Positive")
elseif number < 0
    disp("Negative")
else
    disp("Zero")
end`,
  "Classroom Points (MATLAB): Fully Formatted Plot": `x = 10:0.1:22;
y = 95000 ./ x.^2;
plot(x, y)
title('Theoretical curve')
xlabel('x')
ylabel('y')
axis([8 24 0 1200])
grid on
text(14, 700, 'Sample point')`,
  "Classroom Points (MATLAB): Function with Input but No Output": `function greetUser(name)
    disp(['Hello ' char(name) ', welcome to MATLAB!'])
end`,
  "Classroom Points (MATLAB): Function with Multiple Outputs": `function [area, circumference] = circleProperties(radius)
    area = pi * radius^2;
    circumference = 2 * pi * radius;
end`,
  "Classroom Points (MATLAB): Function with No Input and No Output": `function plotSineWave
    x = linspace(0, 2*pi, 200);
    y = sin(x);
    plot(x, y)
    title('Sine wave')
    xlabel('x')
    ylabel('sin(x)')
end`,
  "Classroom Points (MATLAB): Function with Two Inputs": `function area = rectangleArea(length, width)
    area = length * width;
end`,
  "Classroom Points (MATLAB): Matrix Creation and Indexing": `A = [3 2 1; 5 1 0; 2 1 7];
disp(A(2, :))
disp(A(:, 3))
disp(A(2, 3))
disp(A')`,
  "Classroom Points (MATLAB): Multiple Graphs in Same Plot": `x = 0:0.1:5;
y1 = x.^2;
y2 = 2*x;
plot(x, y1, 'r-', x, y2, 'g--')
legend('y1', 'y2')`,
  "Classroom Points (MATLAB): Plot a Function": `x = -2:0.1:2;
y = x.^3 - 2*x + 1;
plot(x, y, 'b--', 'LineWidth', 2)`,
  "Classroom Points (MATLAB): Variables and Workspace": `a = 15;
b = 7;
c = a^2 + b^2;
disp(c)
whos
clear a
whos`,
  "Classroom Points (MATLAB): Vectors Using Colon Operator": `x = 0:2:10;
y = 5:-1:-5;
disp(x)
disp(y)
z = x .* 2;
disp(z)`,
  "Classroom Points (MATLAB): fplot Command": `fplot(@(x) x.^2 + 4*sin(2*x) - 1, [-3 3])
title('fplot example')
xlabel('x')
ylabel('y')`,
}
