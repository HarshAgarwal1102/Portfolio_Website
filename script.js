var typeData = new Typed(".role", {
    strings: [
      "Web Developer",
      "Software Developer",
      "Coder",
    ],
    loop: true,
    typeSpeed: 100,
    backSpeed: 80,
    backDelay: 1000,
});

// let form = document.getElementById("form");

// form.addEventListener("submit", (e) => {
//   e.preventDefault();

//   let name = document.getElementById("name");
//   let email = document.getElementById("email");
//   let subject = document.getElementById("subject");
//   let text = document.getElementById("text");

//     // perform operation with form input
//   alert("This form has been successfully submitted!");
//   console.log(
//       `This form has a Name of ${name.value} and Email of ${email.value} and subject of ${subject.value}`
//   );

//   name.value = "";
//   email.value = "";
//   subject.value = "";
//   text.value = "";

// });

function sendEmail(){
  let name = document.getElementById("name");
let email = document.getElementById("email");
let subject = document.getElementById("subject");
let text = document.getElementById("text");

if(name.value != "" && email.value != ""){
  Email.send({
    SecureToken : 'faeb2343-9457-4c0c-a9d8-43bbcf3bb4ba',
    // Host : "smtp.elasticemail.com",
    // Username : "harshagarwal.4404@gmail.com",
    // Password : "83030ADE7A413D10666979A418B9B05D94C6",
    To : 'harshagarwal.4404@gmail.com',
    From : 'harshagarwal.4404@gmail.com',
    // From : document.getElementById("email").value,
    Subject : document.getElementById("subject").value,
    Body : "Name : "+ document.getElementById("name").value
      + "<br> Email : "+ document.getElementById("email").value
      + "<br> text : " + document.getElementById("text").value
}).then(
  message => {
    if(message == 'OK'){
      swal("Received!", "Data has been successfully submitted !!", "success");
    }
    else{
      swal("Something Went Wrong!", "Data has not submitted !!!", "error");
    }
  }
);
}
else{
  swal("Something Went Wrong!", "Data has not submitted!", "error");
}
}