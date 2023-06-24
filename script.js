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

let form = document.getElementById("form");

form.addEventListener("submit", (e) => {
  e.preventDefault();

  let name = document.getElementById("name");
  let email = document.getElementById("email");
  let subject = document.getElementById("subject");
  let text = document.getElementById("text");

    // perform operation with form input
  alert("This form has been successfully submitted!");
  console.log(
      `This form has a Name of ${name.value} and Email of ${email.value} and subject of ${subject.value}`
  );

  name.value = "";
  email.value = "";
  subject.value = "";
  text.value = "";

});