
var mainApp = angular.module("mainApp", ['mainApp.config', 'treasure-overlay-spinner', 'ngIdle', 'angular-loading-bar']);

//Use local values, destroyed on reload
mainApp.value('LOCAL_USER', {});
mainApp.config(['$locationProvider', function($locationProvider) { 
    $locationProvider.html5Mode({ enabled: true, requireBase: false }); 
}]);
mainApp.controller("mainController", function($rootScope, $scope, $http, $log, APIServerURL, $document, $timeout, LOCAL_USER, $location) {
    // SetUp global variables here
    $scope.SERVER = APIServerURL; //server base URL http://a.applify.in/rms/
    var loadPromiseViewLatestOrders = null; //Pointer to the promise created by the Angular $timout service

    //Waiting
    $rootScope.spinner = {
        active: false
    };

    angular.element(document).ready(function() {
        input = $document.find("input");
        for (var i = 0; i < input.length; i++) {
            input[i].addEventListener("mousewheel", function(evt) { evt.preventDefault(); })
        }
    });

    var nextLoadviewNUCs = function(millseconds) {
        cancelNextLoadviewNUCs();
        loadPromiseViewLatestOrders = $timeout(function() {$scope.viewNUCs()}, millseconds);
    };

    var cancelNextLoadviewNUCs = function() {
        //Always make sure the last timeout is cleared before starting a new one
        if(loadPromiseViewLatestOrders)
            $timeout.cancel(loadPromiseViewLatestOrders);
    };

    $scope.nuc = [];
    //Get Servers
    $scope.viewNUCs = function() {
        console.log("Calling API");
        $scope.searchedStation = {};
        timelimitminutes = 30;
        var url = $scope.SERVER + 'module.php?to=Servers.listAll&detailed&callback=JSON_CALLBACK';

        $http({
            method: 'JSONP',
            url: url
        }).success(function(data, status, headers, config) {
            if (data.status == "error") {
                swal({
                    title: 'We have an Error',
                    text: data.msg,
                    type: 'warning',
                    showCancelButton: true,
                    //cancelButtonText: 'Wait',
                    confirmButtonColor: '#3085d6',
                    //cancelButtonColor: '#d33',
                    confirmButtonText: 'OK'
                }).then(function () {
                    //window.location.href = '../';
                }, function (dismiss) {
                    // dismiss can be 'cancel', 'overlay',
                    // 'close', and 'timer'
                    //if (dismiss === 'cancel') {
                        //nextLoadviewNUCs(60000);
                    //}
                });
            } else {
                //hide summary
                $scope.searchedStation.showSummaryByStation = false;
                $scope.searchedStation.showOrdersByStation = true;
                $scope.nucs = data;
                //nextLoadviewNUCs(30000);
                angular.forEach(data, function(value, key) {
                    $scope.nuc[value.id] = [];
                    scheduleServerStatusCheck(value.id);
                });
            }
            //nextLoadviewNUCs(600000);
        }).error(function(data, status, headers, config) {
            //nextLoadviewNUCs(60000);
            $log.log('GOT Error while fetching NUC list : ' + status + "");
        });
    };

    $scope.startMtcTunnel = function(id) {
        console.log("Start Mtc for ID: " + id);
        url = $scope.SERVER + 'module.php?to=Servers.mtcTunnel&id='+id+'&op=start&callback=JSON_CALLBACK';
        $http({
            method: 'JSONP',
            url: url
        }).success(function(data, status, headers, config) {
            if(data.status == "success")
            {
                $scope.nuc[id].mtctunnelstatus = 1;
                swal({
                    title: 'Success',
                    type: "success",
                    html: "Asked NUC to start a maintenance tunnel, may take upto 2 minutes to start on server port 19998, see slack #noc for confirmation. Then run following commands from reporting server. <pre align='left'>$ ssh-keygen -f ~/.ssh/known_hosts -R [localhost]:19998 \n$ ssh <username>@localhost -p 19998</pre>"
                });
            }
            else
            {
                swal("There was an error, try again");
            }
            console.log(data);
        }).error(function(data, status, headers, config) {
            swal('GOT Error while fetching NUC data : ' + status + "");
        });
    }
    $scope.killMtcTunnel = function(id) {
        console.log("Kill Mtc for ID: " + id);
        url = $scope.SERVER + 'module.php?to=Servers.mtcTunnel&id='+id+'&op=kill&callback=JSON_CALLBACK';
        $http({
            method: 'JSONP',
            url: url
        }).success(function(data, status, headers, config) {
            if(data.status == "success")
            {
                $scope.nuc[id].mtctunnelstatus = 0;
                swal("Asked NUC to kill maintenance tunnel (if any), may take upto a minute to kill on server port 19998");
            }
            else
            {
                swal("There was an error, try again");
            }
            console.log(data);
        }).error(function(data, status, headers, config) {
            swal('GOT Error while fetching NUC data : ' + status + "");
        });
    }
    scheduleServerStatusCheck = function(id) {
        console.log(id);
        url = $scope.SERVER + 'module.php?to=Servers.status&id='+id+'&callback=JSON_CALLBACK';
        $http({
            method: 'JSONP',
            url: url
        }).success(function(data, status, headers, config) {
            $scope.nuc[id] = data;
            console.log(data);
        }).error(function(data, status, headers, config) {
            $log.log('GOT Error while fetching NUC data : ' + status + "");
        });
    }

    //Search count of sent SMS
    $scope.calledstoreid = 0;
    $scope.searchSMSRecords = [];
    startdate = new Date(); startdate.setHours(0); startdate.setMinutes(0); startdate.setSeconds(0);startdate.setMilliseconds(0);
    $scope.searchSMSRecords.startdate = startdate;
    enddate = new Date(); enddate.setHours(23); enddate.setMinutes(59); enddate.setSeconds(0);enddate.setMilliseconds(0);
    $scope.searchSMSRecords.enddate = enddate;
    $scope.setStoreToCall = function(id, name) {
        //console.log(id);
        $scope.calledstoreid = id;
        $scope.calledstorename = name;

        $scope.searchSMSRecords.data = [];
        $scope.searchSMSRecords.serverdata = [];
        $scope.searchSMSRecords.showReport = false;
    }
    $scope.getSMSRecords = function() {
        id = $scope.calledstoreid;
        //console.log(id);
        startdate = encodeURIComponent($scope.searchSMSRecords.startdate.getFullYear() + "-" + ($scope.searchSMSRecords.startdate.getMonth() + 1) + "-" + $scope.searchSMSRecords.startdate.getDate()+' '+$scope.searchSMSRecords.startdate.getHours()+':'+$scope.searchSMSRecords.startdate.getMinutes()+':'+$scope.searchSMSRecords.startdate.getSeconds());
        enddate = encodeURIComponent($scope.searchSMSRecords.enddate.getFullYear() + "-" + ($scope.searchSMSRecords.enddate.getMonth() + 1) + "-" + $scope.searchSMSRecords.enddate.getDate()+' '+$scope.searchSMSRecords.enddate.getHours()+':'+$scope.searchSMSRecords.enddate.getMinutes()+':'+$scope.searchSMSRecords.enddate.getSeconds());

        var url = $scope.SERVER + 'module.php?to=Servers.call&id='+id+'&call=' + encodeURIComponent("api/module.php?to=SMS.report&startdate="+encodeURIComponent(startdate)+"&enddate="+encodeURIComponent(enddate))+'&callback=JSON_CALLBACK';
        $http({
            method: 'JSONP',
            url: url
        }).success(function(data, status, headers, config) {
            if (data.status == "error") {
                console.log("Error getting SMS report "+data.msg);
                swal({
                    title: 'We have an Error',
                    text: data.msg,
                    type: 'warning',
                    showCancelButton: false,
                    cancelButtonText: 'Wait',
                    confirmButtonColor: '#3085d6',
                    cancelButtonColor: '#d33',
                    confirmButtonText: 'OK'
                }).then(function () {
                    //window.location.href = '../';
                });
            } else {
                $scope.searchSMSRecords.data = data.data;
                $scope.searchSMSRecords.showReport = true;
            }
        }).error(function(data, status, headers, config) {
            console.log('GOT Error while fetching SMS report : ' + status + "");
            $scope.searchSMSRecords.data = [];
            $scope.searchSMSRecords.showReport = false;
            swal({
                title: 'Store SMS',
                text: "Unable to communicate with store",
                type: 'warning',
                showCancelButton: false,
                cancelButtonText: 'Wait',
                confirmButtonColor: '#3085d6',
                cancelButtonColor: '#d33',
                confirmButtonText: 'OK'
            }).then(function () {
                //window.location.href = '../';
            });
        });
        //Count SMS sent from server
        var url = $scope.SERVER + "module.php?to=SMS.report&startdate="+encodeURIComponent(startdate)+"&enddate="+encodeURIComponent(enddate)+"&store="+id+"&callback=JSON_CALLBACK";
        $http({
            method: 'JSONP',
            url: url
        }).success(function(data, status, headers, config) {
            if (data.status == "error") {
                console.log("Error getting SMS report "+data.msg);
                swal({
                    title: 'Server SMS',
                    text: data.msg,
                    type: 'warning',
                    showCancelButton: false,
                    cancelButtonText: 'Wait',
                    confirmButtonColor: '#3085d6',
                    cancelButtonColor: '#d33',
                    confirmButtonText: 'OK'
                }).then(function () {
                    //window.location.href = '../';
                });
            } else {
                $scope.searchSMSRecords.serverdata = data.data;
                $scope.searchSMSRecords.showReport = true;
            }
        }).error(function(data, status, headers, config) {
            console.log('GOT Error while fetching SMS report : ' + status + "");
            $scope.searchSMSRecords.data = [];
            $scope.searchSMSRecords.showReport = false;
            swal({
                title: 'We have an Error',
                text: "Unable to communicate with server",
                type: 'warning',
                showCancelButton: false,
                cancelButtonText: 'Wait',
                confirmButtonColor: '#3085d6',
                cancelButtonColor: '#d33',
                confirmButtonText: 'OK'
            }).then(function () {
                //window.location.href = '../';
            });
        });

    };

    $scope.viewNUCs();
});
