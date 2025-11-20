# number 1
name = input("Enter name: ")
if name == "Aleksandre":
    print("Mentor")
else:
    print("student")
    # number 2
    name = input("Enter name: ")
if name == 'ana':
    print(3)
else:
    print("idk")

# number 3
while True:
    number = int(input("Enter number from 1 to 10: "))
    correct_number = 7
    if number == correct_number:
        print("win!")
        quit("You win! ending program")
    else:
        print("lose!")