// get form and inputs
const form = document.getElementById("form-box");
const userMail = document.getElementById("email");
const passCode = document.getElementById("passcode");

// fake database (for learning)
let UserDetails = [
    {
        userName: "Mike Obangi",
        useremail: "example@gmail.com",
        password: "123@HIM",
        role: "Agent",
    },
    {
        userName: "Sarah Kato",
        useremail: "manager@gmail.com",
        password: "manager123",
        role: "Manager",

    },
    {
        userName: "John Doe",
        useremail: "director@gmail.com",
        password: "director123",
        role: "Director",
    }
];


// listen for form submit
form.addEventListener("submit", function (event) {
    event.preventDefault();

    let typedEmail = userMail.value;
    let typedPassword = passCode.value;

    let userFound = false;

    for (let i = 0; i < UserDetails.length; i++) {
        if (
            typedEmail === UserDetails[i].useremail &&
            typedPassword === UserDetails[i].password
        ) {
            userFound = true;

            alert(" Welcome " + UserDetails[i].userName);
            const role = UserDetails[i].role;

            if (role === "Agent") {
                window.location.href = "/Dashbord forms/html/sellersDashboard.html";
                break;
            } 
            else if (role === "Director") {
                window.location.href = "/Dashbord forms/DirectorsDashboard/directorsDashboard.html";
                break;
            } 
            else if (role === "Manager") {
                window.location.href = "/Dashbord forms/html/managersDashboard.html";
                break;
            }
    
        }
    }

    if (!userFound) {
        alert("Invalid email or password");
    }
});
